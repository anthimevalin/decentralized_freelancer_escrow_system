const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("FreelancerEscrow Contract", function () {
    let FreelancerEscrow, escrow, client, freelancer, arbitrator1, arbitrator2, arbitrator3, arbitrator4, arbitrator5, governanceToken;

    beforeEach(async function () {
        [client, freelancer, arbitrator1, arbitrator2, arbitrator3, arbitrator4, arbitrator5] = await ethers.getSigners(); // Get test accounts

        const totalPayment = ethers.parseEther("1.0"); // Parse 1 Ether to Wei
        const projectDescription = "Build a dApp";
        const milestoneCount = 1;

        const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
        governanceToken = await GovernanceToken.deploy();
        await governanceToken.waitForDeployment();

        await governanceToken.addArbitrator(arbitrator1.address);
        await governanceToken.addArbitrator(arbitrator2.address);
        await governanceToken.addArbitrator(arbitrator3.address);
        await governanceToken.addArbitrator(arbitrator4.address);
        await governanceToken.addArbitrator(arbitrator5.address);

        FreelancerEscrow = await ethers.getContractFactory("FreelancerEscrow");
        escrow = await FreelancerEscrow.deploy(client.address, freelancer.address, totalPayment, projectDescription, governanceToken.target, milestoneCount);
        await escrow.waitForDeployment();
   
    });

    it("Should initialize correctly", async function () {
        expect(await escrow.client()).to.equal(client.address);
        expect(await escrow.freelancer()).to.equal(freelancer.address);
        expect(await escrow.totalPayment()).to.equal(ethers.parseEther("1.0"));
        expect(await escrow.projectDescription()).to.equal("Build a dApp");
        expect(await escrow.milestoneCount()).to.equal(1);
    });


  ///////////////////////////// makeDeposit FUNCTION /////////////////////////////

    it("Should allow the client to make a deposit", async function () {
        const depositAmount = ethers.parseEther("0.4");
        const expectedCommission = depositAmount * BigInt(5) / BigInt(100); // 5% commission
        const requiredPayment = depositAmount + expectedCommission;

        //console.log("Deposit Amount (ETH):", ethers.formatEther(depositAmount));
        //console.log("Expected Commission (ETH):", ethers.formatEther(expectedCommission));
        //console.log("Required Payment (ETH):", ethers.formatEther(requiredPayment));

        const initialClientBalance = await ethers.provider.getBalance(client.address);
        //console.log("Initial Client Balance (ETH):", ethers.formatEther(initialClientBalance));

        // Client makes the deposit
        const tx = await escrow.connect(client).makeDeposit(depositAmount, { value: requiredPayment });

        //console.log("Transaction Gas Price (ETH):", ethers.formatEther(tx.gasPrice));
        const finalClientBalance = await ethers.provider.getBalance(client.address);

        //console.log("Final Client Balance (ETH):", ethers.formatEther(finalClientBalance));

        const gasFeeMargin = ethers.parseEther("0.01");

        // Check if the balance difference matches expectations
        const balanceDifference = initialClientBalance - finalClientBalance;
        //console.log("Balance Difference (ETH):", ethers.formatEther(balanceDifference));

        expect(
            (balanceDifference >= requiredPayment) && 
            (balanceDifference <= requiredPayment + gasFeeMargin)
        ).to.be.true;

        // Verify state transition
        const state = await escrow.state();
        //console.log("Contract State After Deposit:", state);
        expect(state).to.equal(1); // AWAITING_DELIVERABLE

        // Verify contract balance
        const contractBalance = await ethers.provider.getBalance(escrow.target);
        //console.log("Contract Balance (ETH):", ethers.formatEther(contractBalance));
        expect(contractBalance).to.equal(requiredPayment);

        // Verify the event was emitted
        await expect(tx)
            .to.emit(escrow, "DepositMade")
            .withArgs(client.address, freelancer.address, depositAmount);
    });


    it("Should revert if deposit is made by someone other than the client", async function () {
        /*
            Should run successfully if:
                - The contract reverts with the message "Only client can perform this action"
        */

        const depositAmount = ethers.parseEther("0.4");
        const expectedCommission = depositAmount * BigInt(5) / BigInt(100); // 5% commission
        const requiredPayment = depositAmount + expectedCommission;

        // Attempt to make deposit from a non-client address
        await expect(
            escrow.connect(freelancer).makeDeposit(depositAmount, { value: requiredPayment })
        ).to.be.revertedWith("Only client can perform this action");
    });

    it("The sum of all deposits must equal the total payment", async function () {
        const depositAmount = ethers.parseEther("0.4");
        const expectedCommission = depositAmount * BigInt(5) / BigInt(100); // 5% commission
        const requiredPayment = depositAmount + expectedCommission;

        const totalPayment = ethers.parseEther("1.0");

        //console.log("Deposit Amount (ETH):", ethers.formatEther(depositAmount));
        //console.log("Expected Commission (ETH):", ethers.formatEther(expectedCommission));
        //console.log("Required Payment (ETH):", ethers.formatEther(requiredPayment));

        const initialClientBalance = await ethers.provider.getBalance(client.address);
        //console.log("Initial Client Balance (ETH):", ethers.formatEther(initialClientBalance));

        // Client makes the deposit
        const tx = await escrow.connect(client).makeDeposit(depositAmount, { value: requiredPayment });

        //console.log("Transaction Gas Price (ETH):", ethers.formatEther(tx.gasPrice));
        const finalClientBalance = await ethers.provider.getBalance(client.address);

        //console.log("Final Client Balance (ETH):", ethers.formatEther(finalClientBalance));

        const gasFeeMargin = ethers.parseEther("0.01");

        // Check if the balance difference matches expectations
        const balanceDifference = initialClientBalance - finalClientBalance;
        //console.log("Balance Difference (ETH):", ethers.formatEther(balanceDifference));

        expect(
            (balanceDifference >= requiredPayment) && 
            (balanceDifference <= requiredPayment + gasFeeMargin)
        ).to.be.true;

        // Verify state transition
        const state = await escrow.state();
        //console.log("Contract State After Deposit:", state);
        expect(state).to.equal(1); // AWAITING_DELIVERABLE

        // Verify contract balance
        const contractBalance = await ethers.provider.getBalance(escrow.target);
        //console.log("Contract Balance (ETH):", ethers.formatEther(contractBalance));
        expect(contractBalance).to.equal(requiredPayment);

        // Verify the event was emitted
        await expect(tx)
            .to.emit(escrow, "DepositMade")
            .withArgs(client.address, freelancer.address, depositAmount);

        // Confirm delivery
        const completionMessage = "Milestone completed successfully";
        expect(await escrow.state()).to.equal(1);
        // Freelancer completes the deliverable
        await escrow.connect(freelancer).completedMilestone(completionMessage);
        await escrow.connect(client).confirmMilestoneAndMakePayment();

        // Make a second deposit
        const depositAmount2 = ethers.parseEther("0.5");
        const expectedCommission2 = (totalPayment - depositAmount) * BigInt(5) / BigInt(100); // 5% commission
        const requiredPayment2 = totalPayment - depositAmount + expectedCommission2;

        const initialClientBalance2 = await ethers.provider.getBalance(client.address);
        //console.log("Initial Client Balance (ETH):", ethers.formatEther(initialClientBalance));

        // Client makes the deposit
        const tx2 = await escrow.connect(client).makeDeposit(depositAmount2, { value: requiredPayment2 });

        //console.log("Transaction Gas Price (ETH):", ethers.formatEther(tx.gasPrice));
        const finalClientBalance2 = await ethers.provider.getBalance(client.address);

        //console.log("Final Client Balance (ETH):", ethers.formatEther(finalClientBalance));

        // Check if the balance difference matches expectations
        const balanceDifference2 = initialClientBalance2 - finalClientBalance2;
        //console.log("Balance Difference (ETH):", ethers.formatEther(balanceDifference));

        expect(
            (balanceDifference2 >= requiredPayment2) && 
            (balanceDifference2 <= requiredPayment2 + gasFeeMargin)
        ).to.be.true;

        // Verify state transition
        const state2 = await escrow.state();
        //console.log("Contract State After Deposit:", state);
        expect(state2).to.equal(1); // AWAITING_DELIVERABLE

        // Verify contract balance
        const contractBalance2 = await ethers.provider.getBalance(escrow.target);
        //console.log("Contract Balance (ETH):", ethers.formatEther(contractBalance));
        expect(contractBalance2).to.equal(requiredPayment2);

        // Verify the event was emitted
        await expect(tx2)
            .to.emit(escrow, "DepositMade")
            .withArgs(client.address, freelancer.address, totalPayment - depositAmount);
    });


///////////////////////////// completedMilestone FUNCTION /////////////////////////////

    it("Should allow the freelancer to complete the deliverable with a message", async function () {
        /*
            Should run successfully if:
                - The contract's state transitions to AWAITING_PAYMENT
                - The completion message is stored correctly
                - The event DeliverableCompleted is emitted with the correct arguments

        */
        const depositAmount = ethers.parseEther("0.4");
        const expectedCommission = depositAmount * BigInt(5) / BigInt(100); // 5% commission
        const requiredPayment = depositAmount + expectedCommission;

        // Client makes the deposit
        await escrow.connect(client).makeDeposit(depositAmount, { value: requiredPayment });

        const completionMessage = "Milestone completed successfully";
        expect(await escrow.state()).to.equal(1);
        // Freelancer completes the deliverable
        const tx = await escrow.connect(freelancer).completedMilestone(completionMessage);
        await tx.wait(); // Wait for the transaction to be mined

        // Verify state transition
        expect(await escrow.state()).to.equal(2); // AWAITING_APPROVAL

        // Verify the stored completion message
        expect(await escrow.completionMessage()).to.equal(completionMessage);

        // Verify the event was emitted
        await expect(tx)
            .to.emit(escrow, "MilestoneCompleted")
            .withArgs(freelancer.address, client.address, completionMessage);
    });

    it("Should revert if deliverable completed is called by someone else", async function () {
        /*
            Should run successfully if:
                - The contract reverts with the message "Only freelancer can perform this action"
        */

        const depositAmount = ethers.parseEther("0.4");
        const expectedCommission = depositAmount * BigInt(5) / BigInt(100); // 5% commission
        const requiredPayment = depositAmount + expectedCommission;
        escrow.connect(client).makeDeposit(depositAmount, { value: requiredPayment })
        const completionMessage = "Milestone completed successfully";

        // Attempt to complete deliverable from a non-freelancer address
        await expect(
            escrow.connect(client).completedMilestone(completionMessage)
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

        const depositAmount = ethers.parseEther("0.4");
        const expectedCommission = depositAmount * BigInt(5) / BigInt(100); // 5% commission
        const requiredPayment = depositAmount + expectedCommission;
        await escrow.connect(client).makeDeposit(depositAmount, { value: requiredPayment })

        // Freelancer completes the deliverable
        const completionMessage = "Deliverable completed successfully";
        await escrow.connect(freelancer).completedMilestone(completionMessage);

        // Record the initial balance of the freelancer
        const initialFreelancerBalance = await ethers.provider.getBalance(freelancer.address);

        // Client confirms delivery
        const tx = await escrow.connect(client).confirmMilestoneAndMakePayment();
        await tx.wait();

        // Verify state transition
        expect(await escrow.state()).to.equal(0); // AWAITING_DEPOSIT  

        // Verify funds were transferred to the freelancer
        const finalFreelancerBalance = await ethers.provider.getBalance(freelancer.address);
        expect(finalFreelancerBalance - initialFreelancerBalance).to.equal(depositAmount);
    });

    it("Should trasnfer the commission fee to the owner", async function () {
        /*
            Should run successfully if: 
                - The contract's state transitions to CONFIRMED
                - The funds are transferred to the freelancer
                - The event DeliveryConfirmed is emitted with the correct arguments
                - The event PaymentMade is emitted with the correct arguments
        */

        const depositAmount = ethers.parseEther("0.4");
        const expectedCommission = depositAmount * BigInt(5) / BigInt(100); // 5% commission
        const requiredPayment = depositAmount + expectedCommission;
        await escrow.connect(client).makeDeposit(depositAmount, { value: requiredPayment })

        // Freelancer completes the deliverable
        const completionMessage = "Deliverable completed successfully";
        await escrow.connect(freelancer).completedMilestone(completionMessage);

        // Record the initial balance of the freelancer
        const initialCorpBalance = await ethers.provider.getBalance(escrow.corp());

        // Client confirms delivery
        const tx = await escrow.connect(client).confirmMilestoneAndMakePayment();
        await tx.wait();

        // Verify state transition
        expect(await escrow.state()).to.equal(0); // AWAITING_DEPOSIT  

        // Verify funds were transferred to the freelancer
        const finalCorpBalance = await ethers.provider.getBalance(escrow.corp());

        const gasFeeMargin = ethers.parseEther("0.01");

        // Check if the balance difference matches expectations
        const balanceDifference = finalCorpBalance - initialCorpBalance;
        //console.log("Balance Difference (ETH):", ethers.formatEther(balanceDifference));

        expect(
            (balanceDifference >= expectedCommission) && 
            (balanceDifference <= expectedCommission + gasFeeMargin) &&
            ((await ethers.provider.getBalance(escrow.target)) == 0)
        ).to.be.true;
    });

    it("Finishing all milestones should set the state to completed", async function () {
        const depositAmount = ethers.parseEther("0.4");
        const expectedCommission = depositAmount * BigInt(5) / BigInt(100); // 5% commission
        const requiredPayment = depositAmount + expectedCommission;

        const totalPayment = ethers.parseEther("1.0");

        //console.log("Deposit Amount (ETH):", ethers.formatEther(depositAmount));
        //console.log("Expected Commission (ETH):", ethers.formatEther(expectedCommission));
        //console.log("Required Payment (ETH):", ethers.formatEther(requiredPayment));

        const initialClientBalance = await ethers.provider.getBalance(client.address);
        //console.log("Initial Client Balance (ETH):", ethers.formatEther(initialClientBalance));

        // Client makes the deposit
        const tx = await escrow.connect(client).makeDeposit(depositAmount, { value: requiredPayment });

        //console.log("Transaction Gas Price (ETH):", ethers.formatEther(tx.gasPrice));
        const finalClientBalance = await ethers.provider.getBalance(client.address);

        //console.log("Final Client Balance (ETH):", ethers.formatEther(finalClientBalance));

        const gasFeeMargin = ethers.parseEther("0.01");

        // Check if the balance difference matches expectations
        const balanceDifference = initialClientBalance - finalClientBalance;
        //console.log("Balance Difference (ETH):", ethers.formatEther(balanceDifference));

        expect(
            (balanceDifference >= requiredPayment) && 
            (balanceDifference <= requiredPayment + gasFeeMargin)
        ).to.be.true;

        // Verify state transition
        const state = await escrow.state();
        //console.log("Contract State After Deposit:", state);
        expect(state).to.equal(1); // AWAITING_DELIVERABLE

        // Verify contract balance
        const contractBalance = await ethers.provider.getBalance(escrow.target);
        //console.log("Contract Balance (ETH):", ethers.formatEther(contractBalance));
        expect(contractBalance).to.equal(requiredPayment);

        // Verify the event was emitted
        await expect(tx)
            .to.emit(escrow, "DepositMade")
            .withArgs(client.address, freelancer.address, depositAmount);

        // Confirm delivery
        const completionMessage = "Milestone completed successfully";
        expect(await escrow.state()).to.equal(1);
        // Freelancer completes the deliverable
        await escrow.connect(freelancer).completedMilestone(completionMessage);
        await escrow.connect(client).confirmMilestoneAndMakePayment();

        // Make a second deposit
        const depositAmount2 = ethers.parseEther("0.5");
        const expectedCommission2 = (totalPayment - depositAmount) * BigInt(5) / BigInt(100); // 5% commission
        const requiredPayment2 = totalPayment - depositAmount + expectedCommission2;

        const initialClientBalance2 = await ethers.provider.getBalance(client.address);
        //console.log("Initial Client Balance (ETH):", ethers.formatEther(initialClientBalance));

        // Client makes the deposit
        const tx2 = await escrow.connect(client).makeDeposit(depositAmount2, { value: requiredPayment2 });

        //console.log("Transaction Gas Price (ETH):", ethers.formatEther(tx.gasPrice));
        const finalClientBalance2 = await ethers.provider.getBalance(client.address);

        //console.log("Final Client Balance (ETH):", ethers.formatEther(finalClientBalance));

        // Check if the balance difference matches expectations
        const balanceDifference2 = initialClientBalance2 - finalClientBalance2;
        //console.log("Balance Difference (ETH):", ethers.formatEther(balanceDifference));

        expect(
            (balanceDifference2 >= requiredPayment2) && 
            (balanceDifference2 <= requiredPayment2 + gasFeeMargin)
        ).to.be.true;

        // Verify state transition
        const state2 = await escrow.state();
        //console.log("Contract State After Deposit:", state);
        expect(state2).to.equal(1); // AWAITING_DELIVERABLE

        // Verify contract balance
        const contractBalance2 = await ethers.provider.getBalance(escrow.target);
        //console.log("Contract Balance (ETH):", ethers.formatEther(contractBalance));
        expect(contractBalance2).to.equal(requiredPayment2);

        // Verify the event was emitted
        await expect(tx2)
            .to.emit(escrow, "DepositMade")
            .withArgs(client.address, freelancer.address, totalPayment - depositAmount);

        // Confirm completion
        const completionMessage2 = "Milestone completed successfully";
        expect(await escrow.state()).to.equal(1);
        // Freelancer completes the deliverable
        await escrow.connect(freelancer).completedMilestone(completionMessage2);

        expect(await escrow.state()).to.equal(3);

        // Confirm delivery
        await escrow.connect(client).confirmMilestoneAndMakePayment();

        expect(await escrow.state()).to.equal(4);
    });

    ///////////////////////////// raiseDispute FUNCTION /////////////////////////////
    it("Should allow the client to raise a dispute", async function () {
        const depositAmount = ethers.parseEther("0.4");
        const expectedCommission = depositAmount * BigInt(5) / BigInt(100); // 5% commission
        const requiredPayment = depositAmount + expectedCommission;
        await escrow.connect(client).makeDeposit(depositAmount, { value: requiredPayment })

        // Freelancer completes the deliverable
        const completionMessage = "Deliverable completed successfully";
        await escrow.connect(freelancer).completedMilestone(completionMessage);

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
        const depositAmount = ethers.parseEther("0.4");
        const expectedCommission = depositAmount * BigInt(5) / BigInt(100); // 5% commission
        const requiredPayment = depositAmount + expectedCommission;
        await escrow.connect(client).makeDeposit(depositAmount, { value: requiredPayment })
    
        // Freelancer completes the deliverable
        const completionMessage = "Deliverable completed successfully";
        await escrow.connect(freelancer).completedMilestone(completionMessage);
    
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
});
