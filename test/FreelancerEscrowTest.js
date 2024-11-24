const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("FreelancerEscrow Contract", function () {
    let FreelancerEscrow, escrow, client, freelancer;

    beforeEach(async function () {
        [client, freelancer] = await ethers.getSigners(); // Get test accounts

        const totalPayment = ethers.parseEther("1.0"); // Parse 1 Ether to Wei
        const projectDescription = "Build a dApp";

        FreelancerEscrow = await ethers.getContractFactory("FreelancerEscrow");
        escrow = await FreelancerEscrow.deploy(client.address, freelancer.address, totalPayment, projectDescription);
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

});
