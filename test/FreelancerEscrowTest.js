const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("FreelancerEscrow Contract", function () {
    let FreelancerEscrow, escrow, client, freelancer, arbitrator1, arbitrator2, arbitrator3, governanceToken;

    beforeEach(async function () {
        [client, freelancer, arbitrator1, arbitrator2, arbitrator3] = await ethers.getSigners(); // Get test accounts

        const totalPayment = ethers.parseEther("1.0"); // Parse 1 Ether to Wei
        const projectDescription = "Build a dApp";

        const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
        governanceToken = await GovernanceToken.deploy();
        await governanceToken.waitForDeployment();

        await governanceToken.addArbitrator(arbitrator1.address);
        await governanceToken.addArbitrator(arbitrator2.address);
        await governanceToken.addArbitrator(arbitrator3.address);

        FreelancerEscrow = await ethers.getContractFactory("FreelancerEscrow");
        escrow = await FreelancerEscrow.deploy(client.address, freelancer.address, totalPayment, projectDescription, governanceToken.target);
        await escrow.waitForDeployment();
   
    });

    it("Should initialize correctly", async function () {
        expect(await escrow.client()).to.equal(client.address);
        expect(await escrow.freelancer()).to.equal(freelancer.address);
        expect(await escrow.totalPayment()).to.equal(ethers.parseEther("1.0"));
        expect(await escrow.projectDescription()).to.equal("Build a dApp");
    });


  ///////////////////////////// makeDeposit FUNCTION /////////////////////////////

    it("Should allow the client to make a deposit", async function () {
        /*
            Should run successfully if:
                - The client's balance decreases by the deposit amount (including gas fees)
                - The contract's balance increases by the deposit amount (excluding gas fees)
                - The contract's state transitions to AWAITING_DELIVERY
                - The event DepositMade is emitted with the correct arguments
        */


        const depositAmount = await escrow.totalPayment();

        // initial balance of the client
        const initialClientBalance = await ethers.provider.getBalance(client.address);

        // Client makes the deposit
        const tx = await escrow.connect(client).makeDeposit({ value: depositAmount });
        await tx.wait(); // Wait for the transaction to be mined

        // client balance after deposit and check
        const finalClientBalance = await ethers.provider.getBalance(client.address);

        // Define a reasonable range for gas fees (e.g., up to 0.01 ETH)
        const gasFeeMargin = ethers.parseEther("0.01");

        // expect the client balance to less than deposit amount and greater than deposit amount - gas fee margin
        expect(((finalClientBalance - initialClientBalance) <=  -depositAmount) && (finalClientBalance - initialClientBalance) >= -depositAmount - gasFeeMargin).to.be.true;

        // Verify state transition
        expect(await escrow.state()).to.equal(1); // AWAITING_DELIVERY

        // Verify contract balance
        const contractBalance = await ethers.provider.getBalance(escrow.target);
        expect(contractBalance).to.equal(depositAmount);

        // Verify the event was emitted
        await expect(tx)
            .to.emit(escrow, "DepositMade")
            .withArgs(client.address, freelancer.address, depositAmount);
    
    });

    it("Should revert if deposit amount is incorrect", async function () {
        /*
            Should run successfully if:
                - The contract reverts with the message "Incorrect payment amount"
        */

        const depositAmount = await escrow.totalPayment(); // This will be a BigInt
        const incorrectAmount = depositAmount - ethers.parseEther("0.5")

        // Attempt to make deposit with incorrect amount
        await expect(
            escrow.connect(client).makeDeposit({ value: incorrectAmount })
        ).to.be.revertedWith("Incorrect payment amount");
    });

    it("Should revert if deposit is made by someone other than the client", async function () {
        /*
            Should run successfully if:
                - The contract reverts with the message "Only client can perform this action"
        */

        const depositAmount = await escrow.totalPayment();

        // Attempt to make deposit from a non-client address
        await expect(
            escrow.connect(freelancer).makeDeposit({ value: depositAmount })
        ).to.be.revertedWith("Only client can perform this action");
    });

///////////////////////////// completedDeliverable FUNCTION /////////////////////////////

    it("Should allow the freelancer to complete the deliverable with a message", async function () {
        /*
            Should run successfully if:
                - The contract's state transitions to AWAITING_PAYMENT
                - The completion message is stored correctly
                - The event DeliverableCompleted is emitted with the correct arguments

        */


        const depositAmount = await escrow.totalPayment();
        await escrow.connect(client).makeDeposit({ value: depositAmount });
        const completionMessage = "Deliverable completed successfully";

        // Freelancer completes the deliverable
        const tx = await escrow.connect(freelancer).completedDeliverable(completionMessage);
        await tx.wait(); // Wait for the transaction to be mined

        // Verify state transition
        expect(await escrow.state()).to.equal(2); // AWAITING_PAYMENT

        // Verify the stored completion message
        expect(await escrow.completionMessage()).to.equal(completionMessage);

        // Verify the event was emitted
        await expect(tx)
            .to.emit(escrow, "DeliverableCompleted")
            .withArgs(freelancer.address, client.address, completionMessage);
    });

    it("Should revert if deliverable completed is called by someone else", async function () {
        /*
            Should run successfully if:
                - The contract reverts with the message "Only freelancer can perform this action"
        */

        const completionMessage = "Deliverable completed successfully";

        // Attempt to complete deliverable from a non-freelancer address
        await expect(
            escrow.connect(client).completedDeliverable(completionMessage)
        ).to.be.revertedWith("Only freelancer can perform this action");
    });

    ///////////////////////////// confirmDeliveryAndMakePayment FUNCTION /////////////////////////////
    it("Should allow the client to confirm delivery and transfer funds", async function () {
        /*
            Should run successfully if: 
                - The contract's state transitions to CONFIRMED
                - The funds are transferred to the freelancer
                - The event DeliveryConfirmed is emitted with the correct arguments
                - The event PaymentMade is emitted with the correct arguments
        */


        const depositAmount = await escrow.totalPayment();

        // Client makes the deposit
        await escrow.connect(client).makeDeposit({ value: depositAmount });

        // Freelancer completes the deliverable
        const completionMessage = "Deliverable completed successfully";
        await escrow.connect(freelancer).completedDeliverable(completionMessage);

        // Record the initial balance of the freelancer
        const initialFreelancerBalance = await ethers.provider.getBalance(freelancer.address);

        // Client confirms delivery
        const tx = await escrow.connect(client).confirmDeliveryAndMakePayment();
        await tx.wait();

        // Verify state transition
        expect(await escrow.state()).to.equal(3); // CONFIRMED

        // Verify funds were transferred to the freelancer
        const finalFreelancerBalance = await ethers.provider.getBalance(freelancer.address);
        expect(finalFreelancerBalance - initialFreelancerBalance).to.equal(depositAmount);
        
    });

    ///////////////////////////// raiseDispute FUNCTION /////////////////////////////
    it("Should allow the client to raise a dispute", async function () {
        const depositAmount = await escrow.totalPayment();

        // Client makes the deposit
        await escrow.connect(client).makeDeposit({ value: depositAmount });

        // Freelancer completes the deliverable
        const completionMessage = "Deliverable completed successfully";
        await escrow.connect(freelancer).completedDeliverable(completionMessage);

        // Capture the current state before raising the dispute
        const currentState = await escrow.state();

        // Client raises a dispute
        const disputeMessage = "The deliverable was not completed as expected";
        const tx = await escrow.connect(client).raiseDispute(disputeMessage);
        await tx.wait();

        // Verify the event was emitted
        const disputeCount = await escrow.disputeCount(); // Get the updated dispute count
        await expect(tx)
            .to.emit(escrow, "DisputeRaised")
            .withArgs(disputeCount, client.address, currentState, disputeMessage);

        // Retrieve the stored dispute and verify its details
        const dispute = await escrow.disputes(disputeCount - BigInt(1)); // Dispute IDs are 1-based; array is 0-based
        expect(dispute.id).to.equal(disputeCount);
        expect(dispute.raisedBy).to.equal(client.address);
        expect(dispute.currentState).to.equal(currentState);
        expect(dispute.disputeState).to.equal(0); // Enum value for RAISED
        expect(dispute.message).to.equal(disputeMessage);
        expect(dispute.votesForFreelancer).to.equal(0);
        expect(dispute.votesForClient).to.equal(0);
    });
    
    ///////////////////////////// voteOnDispute FUNCTION /////////////////////////////
    it("Should allow multiple arbitrators to vote on a dispute", async function () {
        const depositAmount = await escrow.totalPayment();
    
        // Client makes the deposit
        await escrow.connect(client).makeDeposit({ value: depositAmount });
    
        // Freelancer completes the deliverable
        const completionMessage = "Deliverable completed successfully";
        await escrow.connect(freelancer).completedDeliverable(completionMessage);
    
        // Client raises a dispute
        const disputeMessage = "The deliverable was not completed as expected";
        await escrow.connect(client).raiseDispute(disputeMessage);

        const votingAmount1 = 1;
        const votingAmount2 = 1;
    
        // Arbitrator1 approves tokens for voting
        await governanceToken.connect(arbitrator1).approve(escrow.target, votingAmount1);
    
        // Arbitrator2 approves tokens for voting
        await governanceToken.connect(arbitrator2).approve(escrow.target, votingAmount2);
    
        // Arbitrator1 votes for the freelancer
        const tx1 = await escrow.connect(arbitrator1).voteOnDispute(1, 1);
        await tx1.wait();
    
        // Arbitrator2 votes for the client
        const tx2 = await escrow.connect(arbitrator2).voteOnDispute(1, 2);
        await tx2.wait();
    
        // Verify the vote counts in the dispute
        const dispute = await escrow.disputes(0); // Dispute IDs are 1-based; array is 0-based
        expect(dispute.votesForFreelancer).to.equal(votingAmount1);
        expect(dispute.votesForClient).to.equal(votingAmount2);
    
        // Verify token balance deduction for both arbitrators
        const arbitrator1Balance = await governanceToken.balanceOf(arbitrator1.address);
        const arbitrator2Balance = await governanceToken.balanceOf(arbitrator2.address);
        expect(arbitrator1Balance).to.equal(10 - votingAmount1); // Arbitrator1 started with 10 tokens
        expect(arbitrator2Balance).to.equal(10 - votingAmount2); // Arbitrator2 started with 10 tokens
    
        // Verify event emissions for both votes
        await expect(tx1)
            .to.emit(escrow, "VoteCast")
            .withArgs(1, arbitrator1.address, 1, votingAmount1);
        await expect(tx2)
            .to.emit(escrow, "VoteCast")
            .withArgs(1, arbitrator2.address, 2, votingAmount2);
    });

    it("Should not allow an arbitrator who is the client to vote on a dispute", async function () {
        const depositAmount = await escrow.totalPayment();

        // Client makes the deposit
        await escrow.connect(client).makeDeposit({ value: depositAmount });

        // Freelancer completes the deliverable
        const completionMessage = "Deliverable completed successfully";
        await escrow.connect(freelancer).completedDeliverable(completionMessage);

        // Client raises a dispute
        const disputeMessage = "The deliverable was not completed as expected";
        await escrow.connect(client).raiseDispute(disputeMessage);

        // Add client as an arbitrator in the governance token
        await governanceToken.connect(client).addArbitrator(client.address);

        const votingAmount = 1;

        // Client (as arbitrator) approves tokens for voting
        await governanceToken.connect(client).approve(escrow.target, votingAmount);

        // Attempt to vote as the client, who is also an arbitrator
        await expect(
            escrow.connect(client).voteOnDispute(1, 2)
        ).to.be.revertedWith("Client and freelancer cannot vote");

        // Ensure other arbitrators can still vote
        const votingAmount1 = 1;
        const votingAmount2 = 1;

        await governanceToken.connect(arbitrator1).approve(escrow.target, votingAmount1);
        await governanceToken.connect(arbitrator2).approve(escrow.target, votingAmount2);

        const tx1 = await escrow.connect(arbitrator1).voteOnDispute(1, 2);
        await tx1.wait();

        const tx2 = await escrow.connect(arbitrator2).voteOnDispute(1, 1);
        await tx2.wait();

        // Verify the vote counts in the dispute
        const dispute = await escrow.disputes(0);
        expect(dispute.votesForFreelancer).to.equal(votingAmount1);
        expect(dispute.votesForClient).to.equal(votingAmount2);

        // Verify token balance deduction for arbitrators
        const arbitrator1Balance = await governanceToken.balanceOf(arbitrator1.address);
        const arbitrator2Balance = await governanceToken.balanceOf(arbitrator2.address);
        expect(arbitrator1Balance).to.equal(10 - votingAmount1); // Arbitrator1 started with 100 tokens
        expect(arbitrator2Balance).to.equal(10 - votingAmount2); // Arbitrator2 started with 200 tokens

        // Verify event emissions for valid votes
        await expect(tx1)
            .to.emit(escrow, "VoteCast")
            .withArgs(1, arbitrator1.address, 2, votingAmount1);
        await expect(tx2)
            .to.emit(escrow, "VoteCast")
            .withArgs(1, arbitrator2.address, 1, votingAmount2);
    });

    it("Should correctly save votes from three arbitrators in the votes mapping", async function () {
        const depositAmount = await escrow.totalPayment();

        // Client makes the deposit
        await escrow.connect(client).makeDeposit({ value: depositAmount });

        // Freelancer completes the deliverable
        const completionMessage = "Deliverable completed successfully";
        await escrow.connect(freelancer).completedDeliverable(completionMessage);

        // Client raises a dispute
        const disputeMessage = "The deliverable was not completed as expected";
        await escrow.connect(client).raiseDispute(disputeMessage);

        // Fetch the dispute count
        const disputeCount = await escrow.disputeCount();
        expect(disputeCount).to.equal(1);

        const disputeId = 1;

        // Approve tokens for voting
        await governanceToken.connect(arbitrator1).approve(escrow.target, 1);
        await governanceToken.connect(arbitrator2).approve(escrow.target, 1);
        await governanceToken.connect(arbitrator3).approve(escrow.target, 1);

        // Arbitrators cast their votes
        const tx1 = await escrow.connect(arbitrator1).voteOnDispute(disputeId, 1); // 1 = VoteFor.FREELANCER
        const tx2 = await escrow.connect(arbitrator2).voteOnDispute(disputeId, 2); // 2 = VoteFor.CLIENT
        const tx3 = await escrow.connect(arbitrator3).voteOnDispute(disputeId, 1); // 1 = VoteFor.FREELANCER

        // Verify the dispute counters
        const dispute = await escrow.disputes(disputeId - 1);
        expect(dispute.votesForFreelancer).to.equal(2); // Two votes for FREELANCER
        expect(dispute.votesForClient).to.equal(1); // One vote for CLIENT

        // Verify the emitted events
        await expect(tx1)
            .to.emit(escrow, "VoteCast")
            .withArgs(disputeId, arbitrator1.address, 1, 1); // 1 = VoteFor.FREELANCER
        await expect(tx2)
            .to.emit(escrow, "VoteCast")
            .withArgs(disputeId, arbitrator2.address, 2, 1); // 2 = VoteFor.CLIENT
        await expect(tx3)
            .to.emit(escrow, "VoteCast")
            .withArgs(disputeId, arbitrator3.address, 1, 1); // 1 = VoteFor.FREELANCER
    });

    it("Should revert if the dispute ID is invalid", async function () {
        const depositAmount = await escrow.totalPayment();

        // Client makes the deposit
        await escrow.connect(client).makeDeposit({ value: depositAmount });

        // Freelancer completes the deliverable
        const completionMessage = "Deliverable completed successfully";
        await escrow.connect(freelancer).completedDeliverable(completionMessage);

        // Client raises a dispute
        const disputeMessage = "The deliverable was not completed as expected";
        await escrow.connect(client).raiseDispute(disputeMessage);
        
        const invalidDisputeId = 999; // Non-existent dispute
        await governanceToken.connect(arbitrator1).approve(escrow.target, 1);

        await expect(
            escrow.connect(arbitrator1).voteOnDispute(invalidDisputeId, 1) // 1 = VoteFor.FREELANCER
        ).to.be.revertedWith("Invalid dispute ID");
    });

    it("Should revert if the voter is the client", async function () {
        const depositAmount = await escrow.totalPayment();

        // Client makes the deposit
        await escrow.connect(client).makeDeposit({ value: depositAmount });

        // Freelancer completes the deliverable
        const completionMessage = "Deliverable completed successfully";
        await escrow.connect(freelancer).completedDeliverable(completionMessage);

        // Client raises a dispute
        const disputeMessage = "The deliverable was not completed as expected";
        await escrow.connect(client).raiseDispute(disputeMessage);
        
        const disputeId = 1;
        await governanceToken.connect(client).approve(escrow.target, 1);

        await expect(
            escrow.connect(client).voteOnDispute(disputeId, 1) // 1 = VoteFor.FREELANCER
        ).to.be.revertedWith("Client and freelancer cannot vote");
    });

    it("Should revert if the voter is the freelancer", async function () {
        const depositAmount = await escrow.totalPayment();

        // Client makes the deposit
        await escrow.connect(client).makeDeposit({ value: depositAmount });

        // Freelancer completes the deliverable
        const completionMessage = "Deliverable completed successfully";
        await escrow.connect(freelancer).completedDeliverable(completionMessage);

        // Client raises a dispute
        const disputeMessage = "The deliverable was not completed as expected";
        await escrow.connect(client).raiseDispute(disputeMessage);
        
        const disputeId = 1;
        await governanceToken.connect(freelancer).approve(escrow.target, 1);

        await expect(
            escrow.connect(freelancer).voteOnDispute(disputeId, 2) // 2 = VoteFor.CLIENT
        ).to.be.revertedWith("Client and freelancer cannot vote");
    });

    it("Should revert if the voter does not have enough governance tokens", async function () {
        const depositAmount = await escrow.totalPayment();

        // Client makes the deposit
        await escrow.connect(client).makeDeposit({ value: depositAmount });

        // Freelancer completes the deliverable
        const completionMessage = "Deliverable completed successfully";
        await escrow.connect(freelancer).completedDeliverable(completionMessage);

        // Client raises a dispute
        const disputeMessage = "The deliverable was not completed as expected";
        await escrow.connect(client).raiseDispute(disputeMessage);
        
        const disputeId = 1;

        // Transfer all tokens of arbitrator1 to arbitrator2
        const arbitrator1Balance = await governanceToken.balanceOf(arbitrator1.address);
        await governanceToken.connect(arbitrator1).transfer(arbitrator2.address, arbitrator1Balance);

        await expect(
            escrow.connect(arbitrator1).voteOnDispute(disputeId, 1) // 1 = VoteFor.FREELANCER
        ).to.be.revertedWith("Must hold governance tokens to vote");
    });

    it("Should revert if the voter has already voted on the dispute", async function () {
        const depositAmount = await escrow.totalPayment();

        // Client makes the deposit
        await escrow.connect(client).makeDeposit({ value: depositAmount });

        // Freelancer completes the deliverable
        const completionMessage = "Deliverable completed successfully";
        await escrow.connect(freelancer).completedDeliverable(completionMessage);

        // Client raises a dispute
        const disputeMessage = "The deliverable was not completed as expected";
        await escrow.connect(client).raiseDispute(disputeMessage);
        
        const disputeId = 1;

        // Approve tokens and vote
        await governanceToken.connect(arbitrator1).approve(escrow.target, 1);
        await escrow.connect(arbitrator1).voteOnDispute(disputeId, 1); // 1 = VoteFor.FREELANCER

        // Attempt to vote again
        await expect(
            escrow.connect(arbitrator1).voteOnDispute(disputeId, 2) // 2 = VoteFor.CLIENT
        ).to.be.revertedWith("Cannot vote for the same dispute twice");
    });

    it("Should deduct governance tokens from the voter's balance after voting", async function () {
        const depositAmount = await escrow.totalPayment();

        // Client makes the deposit
        await escrow.connect(client).makeDeposit({ value: depositAmount });

        // Freelancer completes the deliverable
        const completionMessage = "Deliverable completed successfully";
        await escrow.connect(freelancer).completedDeliverable(completionMessage);

        // Client raises a dispute
        const disputeMessage = "The deliverable was not completed as expected";
        await escrow.connect(client).raiseDispute(disputeMessage);
        
        const disputeId = 1;

        // Get initial balance of arbitrator1
        const initialBalance = await governanceToken.balanceOf(arbitrator1.address);

        // Approve tokens and vote
        await governanceToken.connect(arbitrator1).approve(escrow.target, 1);
        await escrow.connect(arbitrator1).voteOnDispute(disputeId, 1); // 1 = VoteFor.FREELANCER

        // Get final balance of arbitrator1
        const finalBalance = await governanceToken.balanceOf(arbitrator1.address);

        // Ensure 1 token was deducted
        expect(finalBalance).to.equal(initialBalance - BigInt(1));
    });

    ///////////////////////////// resolveDispute FUNCTION /////////////////////////////

    it("Should set state to CONFIRMED if the freelancer wins the dispute", async function () {
        const depositAmount = await escrow.totalPayment();

        // Client makes the deposit
        await escrow.connect(client).makeDeposit({ value: depositAmount });

        // Freelancer completes the deliverable
        const completionMessage = "Deliverable completed successfully";
        await escrow.connect(freelancer).completedDeliverable(completionMessage);

        // Client raises a dispute
        const disputeMessage = "The deliverable was not completed as expected";
        await escrow.connect(client).raiseDispute(disputeMessage);

        const disputeID = 1;

        // Arbitrator1 approves tokens for voting
        await governanceToken.connect(arbitrator1).approve(escrow.target, 1);
        await governanceToken.connect(arbitrator2).approve(escrow.target, 1);

        // Arbitrator1 votes for the freelancer
        await escrow.connect(arbitrator1).voteOnDispute(disputeID, 1); // 1 = VoteFor.FREELANCER
        const tx = await escrow.connect(arbitrator2).voteOnDispute(disputeID, 1); // 1 = VoteFor.FREEANCER
        await tx.wait();

        // Verify the state transition
        expect(await escrow.state()).to.equal(3); // CONFIRMED

        // Verify all emitted events
        await expect(tx)
        .to.emit(escrow, "DisputeResolved")
        .withArgs(
        disputeID, // disputeId
        freelancer.address, // winner
        3, // state (CONFIRMED)
        "Freelancer won the dispute" // message
        );

        // Verify the event was emitted
        await expect(tx)
        .to.emit(escrow, "DeliveryConfirmed")
        .withArgs(client.address, freelancer.address); // Arguments for DeliveryConfirmed

        await expect(tx)
        .to.emit(escrow, "PaymentMade")
        .withArgs(freelancer.address, depositAmount); // Arguments for PaymentMade
    });

    it("Should set state to CONFIRMED if the client wins the dispute", async function () {
        const depositAmount = await escrow.totalPayment();

        // Client makes the deposit
        await escrow.connect(client).makeDeposit({ value: depositAmount });

        // Freelancer completes the deliverable
        const completionMessage = "Deliverable completed successfully";
        await escrow.connect(freelancer).completedDeliverable(completionMessage);

        // Client raises a dispute
        const disputeMessage = "The deliverable was not completed as expected";
        await escrow.connect(client).raiseDispute(disputeMessage);

        const disputeID = 1;

        // Arbitrator1 approves tokens for voting
        await governanceToken.connect(arbitrator1).approve(escrow.target, 1);
        await governanceToken.connect(arbitrator2).approve(escrow.target, 1);

        // Arbitrator1 votes for the client
        await escrow.connect(arbitrator1).voteOnDispute(disputeID, 2); // 2 = VoteFor.CLIENT
        const tx = await escrow.connect(arbitrator2).voteOnDispute(disputeID, 2); // 2 = VoteFor.CLIENT
        await tx.wait();

        // Verify the state transition
        expect(await escrow.state()).to.equal(4); // DISSOLVED

        // Verify all emitted events
        await expect(tx)
        .to.emit(escrow, "DisputeResolved")
        .withArgs(
        disputeID, // disputeId
        client.address, // winner
        4, // state (DISSOLVED)
        "Client won the dispute" // message
        );

        // Verify the event was emitted
        await expect(tx)
        .to.emit(escrow, "DepositRefunded")
        .withArgs(client.address, depositAmount); // Arguments for DeliveryConfirmed

    });


    it("Should increase the voters reputation if they vote correctly", async function () {
        const depositAmount = await escrow.totalPayment();

        // Client makes the deposit
        await escrow.connect(client).makeDeposit({ value: depositAmount });

        // Freelancer completes the deliverable
        const completionMessage = "Deliverable completed successfully";
        await escrow.connect(freelancer).completedDeliverable(completionMessage);

        // Client raises a dispute
        const disputeMessage = "The deliverable was not completed as expected";
        await escrow.connect(client).raiseDispute(disputeMessage);

        const disputeID = 1;

        // Arbitrator1 approves tokens for voting
        await governanceToken.connect(arbitrator1).approve(escrow.target, 1);
        await governanceToken.connect(arbitrator2).approve(escrow.target, 1);

        // Arbitrator1 votes for the client
        await escrow.connect(arbitrator1).voteOnDispute(disputeID, 2); // 2 = VoteFor.CLIENT
        const tx = await escrow.connect(arbitrator2).voteOnDispute(disputeID, 2); // 2 = VoteFor.CLIENT
        await tx.wait();

        // Verify the reputation of the arbitrators
        expect(await governanceToken.getReputation(arbitrator1.address)).to.equal(2);
        expect(await governanceToken.getReputation(arbitrator2.address)).to.equal(2);
    });

    it("Should not increase the voters reputation if they vote incorrectly", async function () {
        const depositAmount = await escrow.totalPayment();

        // Client makes the deposit
        await escrow.connect(client).makeDeposit({ value: depositAmount });

        // Freelancer completes the deliverable
        const completionMessage = "Deliverable completed successfully";
        await escrow.connect(freelancer).completedDeliverable(completionMessage);

        // Client raises a dispute
        const disputeMessage = "The deliverable was not completed as expected";
        await escrow.connect(client).raiseDispute(disputeMessage);

        const disputeID = 1;

        // Arbitrator1 approves tokens for voting
        await governanceToken.connect(arbitrator1).approve(escrow.target, 1);
        await governanceToken.connect(arbitrator2).approve(escrow.target, 1);

        // Arbitrator1 votes for the freelancer
        await escrow.connect(arbitrator1).voteOnDispute(disputeID, 1); // 1 = VoteFor.FREELANCER
        const tx = await escrow.connect(arbitrator2).voteOnDispute(disputeID, 2); // 2 = VoteFor.CLIENT
        await tx.wait();

        // Verify the reputation of the arbitrators
        expect(await governanceToken.getReputation(arbitrator1.address)).to.equal(1);
        expect(await governanceToken.getReputation(arbitrator2.address)).to.equal(1);
    });

    it("Should increase the voters governance token balance if they voted correctly", async function () {
        const depositAmount = await escrow.totalPayment();

        // Client makes the deposit
        await escrow.connect(client).makeDeposit({ value: depositAmount });

        // Freelancer completes the deliverable
        const completionMessage = "Deliverable completed successfully";
        await escrow.connect(freelancer).completedDeliverable(completionMessage);

        // Client raises a dispute
        const disputeMessage = "The deliverable was not completed as expected";
        await escrow.connect(client).raiseDispute(disputeMessage);

        const disputeID = 1;

        // Arbitrator1 approves tokens for voting
        await governanceToken.connect(arbitrator1).approve(escrow.target, 1);
        await governanceToken.connect(arbitrator2).approve(escrow.target, 1);

        // Arbitrator1 votes for the client
        await escrow.connect(arbitrator1).voteOnDispute(disputeID, 2); // 2 = VoteFor.CLIENT
        const tx = await escrow.connect(arbitrator2).voteOnDispute(disputeID, 2); // 2 = VoteFor.CLIENT
        await tx.wait();

        // Verify the reputation of the arbitrators
        expect(await governanceToken.balanceOf(arbitrator1.address)).to.equal(11);
        expect(await governanceToken.balanceOf(arbitrator2.address)).to.equal(11);
    });

    it("Should not increase the voters governance token balance if they voted incorrectly", async function () {
        const depositAmount = await escrow.totalPayment();

        // Client makes the deposit
        await escrow.connect(client).makeDeposit({ value: depositAmount });

        // Freelancer completes the deliverable
        const completionMessage = "Deliverable completed successfully";
        await escrow.connect(freelancer).completedDeliverable(completionMessage);

        // Client raises a dispute
        const disputeMessage = "The deliverable was not completed as expected";
        await escrow.connect(client).raiseDispute(disputeMessage);

        const disputeID = 1;

        // Arbitrator1 approves tokens for voting
        await governanceToken.connect(arbitrator1).approve(escrow.target, 1);
        await governanceToken.connect(arbitrator2).approve(escrow.target, 1);

        // Arbitrator1 votes for the freelancer
        await escrow.connect(arbitrator1).voteOnDispute(disputeID, 1); // 1 = VoteFor.FREELANCER
        const tx = await escrow.connect(arbitrator2).voteOnDispute(disputeID, 2); // 2 = VoteFor.CLIENT
        await tx.wait();

        // Verify the reputation of the arbitrators
        expect(await governanceToken.balanceOf(arbitrator1.address)).to.equal(9);
        expect(await governanceToken.balanceOf(arbitrator2.address)).to.equal(9);
    });
});
