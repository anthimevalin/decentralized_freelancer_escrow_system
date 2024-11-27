const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FreelancerEscrow and GovernanceToken Integration", function () {
    let governanceToken, owner, client, freelancer, arbitrators;

    beforeEach(async function () {
        // Generate signers
        [owner, client, freelancer, ...arbitrators] = await ethers.getSigners();

        // Deploy GovernanceToken
        const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
        governanceToken = await GovernanceToken.connect(owner).deploy();
        await governanceToken.deployed();

        // Mint tokens to owner
        const totalSupply = ethers.utils.parseEther("1000");
        await governanceToken.connect(owner).mint(owner.address, totalSupply);

        // Add arbitrators to the GovernanceToken and distribute tokens
        const arbitratorInitialBalance = ethers.utils.parseEther("10");
        for (let i = 0; i < arbitrators.length; i++) {
            await governanceToken.connect(owner).addArbitrator(arbitrators[i].address);
            // Transfer tokens to arbitrators
            await governanceToken.connect(owner).transfer(arbitrators[i].address, arbitratorInitialBalance);
        }
    });

    async function createEscrow(client, freelancer, payment, description) {
        const FreelancerEscrow = await ethers.getContractFactory("FreelancerEscrow");
        const escrow = await FreelancerEscrow.deploy(
            client.address,
            freelancer.address,
            ethers.utils.parseEther(payment),
            description,
            governanceToken.address
        );
        await escrow.deployed();
        return escrow;
    }

    it("Simulates multiple contracts with disputes and arbitrators", async function () {
        const paymentAmount = "10";
        const projectDescription = "Develop a decentralized application";

        // Deploy three escrow contracts
        const escrow1 = await createEscrow(client, freelancer, paymentAmount, projectDescription);
        const escrow2 = await createEscrow(client, freelancer, paymentAmount, projectDescription);
        const escrow3 = await createEscrow(client, freelancer, paymentAmount, projectDescription);

        // Simulate a successful project (no dispute)
        await escrow1.connect(client).makeDeposit({ value: ethers.utils.parseEther(paymentAmount) });
        await escrow1.connect(freelancer).completedDeliverable("Project completed successfully");
        await escrow1.connect(client).confirmDeliveryAndMakePayment();
        expect(await ethers.provider.getBalance(escrow1.address)).to.equal(0);

        // Simulate a project with a dispute (freelancer wins)
        await escrow2.connect(client).makeDeposit({ value: ethers.utils.parseEther(paymentAmount) });
        await escrow2.connect(freelancer).completedDeliverable("Project partially completed");
        const tx1 = await escrow2.connect(client).raiseDispute("Work quality was not satisfactory");

        // Retrieve dispute ID from event
        const receipt1 = await tx1.wait();
        const disputeEvent1 = receipt1.events.find(event => event.event === 'DisputeRaised');
        const disputeID1 = disputeEvent1.args.id;

        // Arbitrators vote
        await governanceToken.connect(arbitrators[0]).approve(escrow2.address, ethers.utils.parseEther("1"));
        await governanceToken.connect(arbitrators[1]).approve(escrow2.address, ethers.utils.parseEther("1"));

        await escrow2.connect(arbitrators[0]).voteOnDispute(disputeID1, 1); // VoteFor.FREELANCER
        await escrow2.connect(arbitrators[1]).voteOnDispute(disputeID1, 1); // VoteFor.FREELANCER

        expect(await escrow2.state()).to.equal(3); // CONFIRMED

        // Simulate a project with a dispute (client wins)
        await escrow3.connect(client).makeDeposit({ value: ethers.utils.parseEther(paymentAmount) });
        await escrow3.connect(freelancer).completedDeliverable("Project completed");
        const tx2 = await escrow3.connect(client).raiseDispute("Work not delivered on time");

        // Retrieve dispute ID from event
        const receipt2 = await tx2.wait();
        const disputeEvent2 = receipt2.events.find(event => event.event === 'DisputeRaised');
        const disputeID2 = disputeEvent2.args.id;

        // Arbitrators vote
        await governanceToken.connect(arbitrators[2]).approve(escrow3.address, ethers.utils.parseEther("1"));
        await governanceToken.connect(arbitrators[3]).approve(escrow3.address, ethers.utils.parseEther("1"));

        await escrow3.connect(arbitrators[2]).voteOnDispute(disputeID2, 2); // VoteFor.CLIENT
        await escrow3.connect(arbitrators[3]).voteOnDispute(disputeID2, 2); // VoteFor.CLIENT

        expect(await escrow3.state()).to.equal(4); // DISSOLVED
    });

    it("Simulates arbitrator behavior and checks for potential exploitation", async function () {
        const paymentAmount = "20";
        const projectDescription = "Create a smart contract";

        const escrow = await createEscrow(client, freelancer, paymentAmount, projectDescription);

        // Deposit by client
        await escrow.connect(client).makeDeposit({ value: ethers.utils.parseEther(paymentAmount) });

        // Raise a dispute
        const tx = await escrow.connect(client).raiseDispute("Incomplete project");
        const receipt = await tx.wait();
        const disputeEvent = receipt.events.find(event => event.event === 'DisputeRaised');
        const disputeID = disputeEvent.args.id;

        // Arbitrators with higher reputation
        await governanceToken.connect(owner).increaseReputation(arbitrators[0].address);
        await governanceToken.connect(owner).increaseReputation(arbitrators[0].address);

        // Arbitrators with different strategies
        await governanceToken.connect(arbitrators[0]).approve(escrow.address, ethers.utils.parseEther("1")); // Honest voting
        await governanceToken.connect(arbitrators[1]).approve(escrow.address, ethers.utils.parseEther("1")); // Random voting

        await escrow.connect(arbitrators[0]).voteOnDispute(disputeID, 1); // Honest vote for freelancer
        await escrow.connect(arbitrators[1]).voteOnDispute(disputeID, 2); // Random vote for client

        // Check if majority wins
        const state = await escrow.state();
        expect(state).to.be.oneOf([3, 4]); // CONFIRMED or DISSOLVED based on votes

        // Analyze token rewards
        const arbitrator0Balance = await governanceToken.balanceOf(arbitrators[0].address);
        const arbitrator1Balance = await governanceToken.balanceOf(arbitrators[1].address);

        console.log(`Arbitrator 0 Balance: ${ethers.utils.formatEther(arbitrator0Balance)}`);
        console.log(`Arbitrator 1 Balance: ${ethers.utils.formatEther(arbitrator1Balance)}`);
    });
});
