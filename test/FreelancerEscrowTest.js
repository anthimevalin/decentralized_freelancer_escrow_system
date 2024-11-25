const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("FreelancerEscrow Contract", function () {
    let FreelancerEscrow, escrow, client, freelancer, arbitrator1, arbitrator2, governanceToken;

    beforeEach(async function () {
        [client, freelancer, arbitrator1, arbitrator2] = await ethers.getSigners(); // Get test accounts

        const totalPayment = ethers.parseEther("1.0"); // Parse 1 Ether to Wei
        const projectDescription = "Build a dApp";

        const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
        governanceToken = await GovernanceToken.deploy();
        await governanceToken.waitForDeployment();

        await governanceToken.addArbitrator(arbitrator1.address);
        await governanceToken.addArbitrator(arbitrator2.address);

        await governanceToken.mint(arbitrator1.address, 100);
        await governanceToken.mint(arbitrator2.address, 200); 

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
        const depositAmount = await escrow.totalPayment();

        // Client makes the deposit
        const tx = await escrow.connect(client).makeDeposit({ value: depositAmount });
        await tx.wait(); // Wait for the transaction to be mined

        // Verify state transition
        expect(await escrow.state()).to.equal(1); // AWAITING_DELIVERY

        // Verify contract balance
        const contractBalance = await ethers.provider.getBalance(escrow.target);
        expect(contractBalance).to.equal(depositAmount);

        // Verify the event was emitted
        await expect(tx)
            .to.emit(escrow, "DepositMade")
            .withArgs(client.address, depositAmount);
    });

    it("Should revert if deposit amount is incorrect", async function () {
        const depositAmount = await escrow.totalPayment(); // This will be a BigInt
        const incorrectAmount = depositAmount - ethers.parseEther("0.5")

        // Attempt to make deposit with incorrect amount
        await expect(
            escrow.connect(client).makeDeposit({ value: incorrectAmount })
        ).to.be.revertedWith("Incorrect payment amount");
    });

    it("Should revert if deposit is made by someone other than the client", async function () {
        const depositAmount = await escrow.totalPayment();

        // Attempt to make deposit from a non-client address
        await expect(
            escrow.connect(freelancer).makeDeposit({ value: depositAmount })
        ).to.be.revertedWith("Only client can perform this action");
    });

///////////////////////////// completedDeliverable FUNCTION /////////////////////////////

    it("Should allow the freelancer to complete the deliverable with a message", async function () {
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
            .withArgs(freelancer.address, completionMessage);
    });

    it("Should revert if deliverable completed is called by someone else", async function () {
        const completionMessage = "Deliverable completed successfully";

        // Attempt to complete deliverable from a non-freelancer address
        await expect(
            escrow.connect(client).completedDeliverable(completionMessage)
        ).to.be.revertedWith("Only freelancer can perform this action");
    });

    ///////////////////////////// confirmDeliveryAndMakePayment FUNCTION /////////////////////////////
    it("Should allow the client to confirm delivery and transfer funds", async function () {
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
    ///////////////////////////// getDisputesByParty FUNCTION /////////////////////////////
    it("Should allow the client to get disputes raised by a party", async function () {
        const depositAmount = await escrow.totalPayment();
    
        // Client makes the deposit
        await escrow.connect(client).makeDeposit({ value: depositAmount });
    
        // Freelancer completes the deliverable
        const completionMessage = "Deliverable completed successfully";
        await escrow.connect(freelancer).completedDeliverable(completionMessage);
    
        // Client raises a dispute
        const disputeMessage = "The deliverable was not completed as expected";
        const disputeCountBefore = await escrow.disputeCount();
        expect(disputeCountBefore).to.equal(0);
        await escrow.connect(client).raiseDispute(disputeMessage);
    
        // Get disputes raised by the client
        const disputes = await escrow.getDisputesByParty(client.address);
    
        // Verify the number of disputes
        expect(disputes.length).to.equal(1);
    
        // Verify the details of the dispute
        const dispute = disputes[0];
        expect(dispute.id).to.equal(disputeCountBefore + BigInt(1)); // Dynamically adjust expected ID
        expect(dispute.raisedBy).to.equal(client.address);
        expect(dispute.currentState).to.equal(2); 
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

        const votingAmount1 = 50;
        const votingAmount2 = 100;
    
        // Arbitrator1 approves tokens for voting
        await governanceToken.connect(arbitrator1).approve(escrow.target, votingAmount1);
    
        // Arbitrator2 approves tokens for voting
        await governanceToken.connect(arbitrator2).approve(escrow.target, votingAmount2);
    
        // Arbitrator1 votes for the freelancer
        const tx1 = await escrow.connect(arbitrator1).voteOnDispute(1, true, votingAmount1);
        await tx1.wait();
    
        // Arbitrator2 votes for the client
        const tx2 = await escrow.connect(arbitrator2).voteOnDispute(1, false, votingAmount2);
        await tx2.wait();
    
        // Verify the vote counts in the dispute
        const dispute = await escrow.disputes(0); // Dispute IDs are 1-based; array is 0-based
        expect(dispute.votesForFreelancer).to.equal(votingAmount1);
        expect(dispute.votesForClient).to.equal(votingAmount2);
    
        // Verify token balance deduction for both arbitrators
        const arbitrator1Balance = await governanceToken.balanceOf(arbitrator1.address);
        const arbitrator2Balance = await governanceToken.balanceOf(arbitrator2.address);
        expect(arbitrator1Balance).to.equal(100 - votingAmount1); // Arbitrator1 started with 100 tokens
        expect(arbitrator2Balance).to.equal(200 - votingAmount2); // Arbitrator2 started with 200 tokens
    
        // Verify event emissions for both votes
        await expect(tx1)
            .to.emit(escrow, "VoteCast")
            .withArgs(1, arbitrator1.address, true, votingAmount1);
        await expect(tx2)
            .to.emit(escrow, "VoteCast")
            .withArgs(1, arbitrator2.address, false, votingAmount2);
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

        const votingAmount = 50;

        // Client (as arbitrator) approves tokens for voting
        await governanceToken.connect(client).approve(escrow.target, votingAmount);

        // Attempt to vote as the client, who is also an arbitrator
        await expect(
            escrow.connect(client).voteOnDispute(1, true, votingAmount)
        ).to.be.revertedWith("Client and freelancer cannot vote");

        // Ensure other arbitrators can still vote
        const votingAmount1 = 50;
        const votingAmount2 = 100;

        await governanceToken.connect(arbitrator1).approve(escrow.target, votingAmount1);
        await governanceToken.connect(arbitrator2).approve(escrow.target, votingAmount2);

        const tx1 = await escrow.connect(arbitrator1).voteOnDispute(1, true, votingAmount1);
        await tx1.wait();

        const tx2 = await escrow.connect(arbitrator2).voteOnDispute(1, false, votingAmount2);
        await tx2.wait();

        // Verify the vote counts in the dispute
        const dispute = await escrow.disputes(0);
        expect(dispute.votesForFreelancer).to.equal(votingAmount1);
        expect(dispute.votesForClient).to.equal(votingAmount2);

        // Verify token balance deduction for arbitrators
        const arbitrator1Balance = await governanceToken.balanceOf(arbitrator1.address);
        const arbitrator2Balance = await governanceToken.balanceOf(arbitrator2.address);
        expect(arbitrator1Balance).to.equal(100 - votingAmount1); // Arbitrator1 started with 100 tokens
        expect(arbitrator2Balance).to.equal(200 - votingAmount2); // Arbitrator2 started with 200 tokens

        // Verify event emissions for valid votes
        await expect(tx1)
            .to.emit(escrow, "VoteCast")
            .withArgs(1, arbitrator1.address, true, votingAmount1);
        await expect(tx2)
            .to.emit(escrow, "VoteCast")
            .withArgs(1, arbitrator2.address, false, votingAmount2);
    });
});
