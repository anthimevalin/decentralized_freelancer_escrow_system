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
        await governanceToken.waitForDeployment();

        // Mint tokens to owner
        await governanceToken.connect(owner).mint(owner.address, 1000);

        // Add arbitrators to the GovernanceToken and distribute tokens
        for (let i = 0; i < arbitrators.length; i++) {
            await governanceToken.connect(owner).addArbitrator(arbitrators[i].address);
        }

    });

    it("Simulates multiple contracts with disputes and arbitrators", async function () {
        const totalPayment = ethers.parseEther("1.0");
        const projectDescription = "Develop a decentralized application";

        // Deploy three escrow contracts

        FreelancerEscrow = await ethers.getContractFactory("FreelancerEscrow");
        escrow1 = await FreelancerEscrow.deploy(client.address, freelancer.address, totalPayment, projectDescription, governanceToken.target);
        await escrow1.waitForDeployment();
        initialFreelancerBalance = await ethers.provider.getBalance(freelancer.address);
        escrow2 = await FreelancerEscrow.deploy(client.address, freelancer.address, totalPayment, projectDescription, governanceToken.target);
        await escrow2.waitForDeployment();

        escrow3 = await FreelancerEscrow.deploy(client.address, freelancer.address, totalPayment, projectDescription, governanceToken.target);
        await escrow3.waitForDeployment();

        // Simulate a successful project (no dispute)
        await escrow1.connect(client).makeDeposit({ value: totalPayment });
        await escrow1.connect(freelancer).completedDeliverable("Project completed successfully");
        const tx = await escrow1.connect(client).confirmDeliveryAndMakePayment();
        await tx.wait();
        expect(await escrow1.state()).to.equal(3); // COMPLETED
        // check freelancer balance 
        //const finalFreelancerBalance = await ethers.provider.getBalance(freelancer.address);
        //expect(finalFreelancerBalance - initialFreelancerBalance).to.equal(totalPayment);

        // check client balance
        expect(await ethers.provider.getBalance(client.address)).to.equal(0);

        // Simulate a project with a dispute (freelancer wins)
        await escrow2.connect(client).makeDeposit({ value: totalPayment });
        await escrow2.connect(freelancer).completedDeliverable("Project partially completed");
        const tx1 = await escrow2.connect(client).raiseDispute("Work quality was not satisfactory");

        await tx1.wait();

        
        // Arbitrators vote
        await governanceToken.connect(arbitrators[0]).approve(escrow2.target, 1);
        await governanceToken.connect(arbitrators[1]).approve(escrow2.target, 1);
        await governanceToken.connect(arbitrators[2]).approve(escrow2.target, 1);
        await governanceToken.connect(arbitrators[3]).approve(escrow2.target, 1);
        await governanceToken.connect(arbitrators[4]).approve(escrow2.target, 1);
        await governanceToken.connect(arbitrators[5]).approve(escrow2.target, 1);
        await governanceToken.connect(arbitrators[6]).approve(escrow2.target, 1);
        await governanceToken.connect(arbitrators[7]).approve(escrow2.target, 1);
        await governanceToken.connect(arbitrators[8]).approve(escrow2.target, 1);
        await governanceToken.connect(arbitrators[9]).approve(escrow2.target, 1);

        // expect arbirators to have 10 tokens in their balance
        expect(await governanceToken.balanceOf(arbitrators[0].address)).to.equal(10);


        await escrow2.connect(arbitrators[0]).voteOnDispute(1, 1); // VoteFor.FREELANCER
        await escrow2.connect(arbitrators[1]).voteOnDispute(1, 1); // VoteFor.FREELANCER
        await escrow2.connect(arbitrators[2]).voteOnDispute(1, 1); // VoteFor.FREELANCER
        await escrow2.connect(arbitrators[3]).voteOnDispute(1, 1); // VoteFor.FREELANCER
        await escrow2.connect(arbitrators[4]).voteOnDispute(1, 1); // VoteFor.FREELANCER
        await escrow2.connect(arbitrators[5]).voteOnDispute(1, 1); // VoteFor.FREELANCER
        await escrow2.connect(arbitrators[6]).voteOnDispute(1, 1); // VoteFor.FREELANCER
        await escrow2.connect(arbitrators[7]).voteOnDispute(1, 1); // VoteFor.FREELANCER
        await escrow2.connect(arbitrators[8]).voteOnDispute(1, 1); // VoteFor.FREELANCER
        await escrow2.connect(arbitrators[9]).voteOnDispute(1, 1); // VoteFor.FREELANCER


        expect(await escrow2.state()).to.equal(3); // CONFIRMED
        
        // Simulate a project with a dispute (client wins)
        await escrow3.connect(client).makeDeposit({ value: totalPayment });

        await escrow3.connect(freelancer).completedDeliverable("Project completed");
        const tx2 = await escrow3.connect(client).raiseDispute("Work not delivered on time");

        await tx2.wait();


        // Arbitrators vote
        await governanceToken.connect(arbitrators[6]).approve(escrow3.target, 1);
        await governanceToken.connect(arbitrators[7]).approve(escrow3.target, 1);
        await governanceToken.connect(arbitrators[8]).approve(escrow3.target, 1);
        await governanceToken.connect(arbitrators[9]).approve(escrow3.target, 1);
        await governanceToken.connect(arbitrators[10]).approve(escrow3.target, 1);
        await governanceToken.connect(arbitrators[11]).approve(escrow3.target, 1);
        await governanceToken.connect(arbitrators[12]).approve(escrow3.target, 1);
        await governanceToken.connect(arbitrators[13]).approve(escrow3.target, 1);
        await governanceToken.connect(arbitrators[14]).approve(escrow3.target, 1);
        await governanceToken.connect(arbitrators[15]).approve(escrow3.target, 1);
        await governanceToken.connect(arbitrators[16]).approve(escrow3.target, 1);

    
        await escrow3.connect(arbitrators[6]).voteOnDispute(1, 2); // VoteFor.CLIENT
        await escrow3.connect(arbitrators[7]).voteOnDispute(1, 2); // VoteFor.CLIENT
        await escrow3.connect(arbitrators[8]).voteOnDispute(1, 2); // VoteFor.CLIENT
        await escrow3.connect(arbitrators[9]).voteOnDispute(1, 2); // VoteFor.CLIENT
        await escrow3.connect(arbitrators[10]).voteOnDispute(1, 2); // VoteFor.CLIENT
        await escrow3.connect(arbitrators[11]).voteOnDispute(1, 2); // VoteFor.CLIENT
        await escrow3.connect(arbitrators[12]).voteOnDispute(1, 2); // VoteFor.CLIENT
        await escrow3.connect(arbitrators[13]).voteOnDispute(1, 2); // VoteFor.CLIENT
        await escrow3.connect(arbitrators[14]).voteOnDispute(1, 2); // VoteFor.CLIENT
        await escrow3.connect(arbitrators[15]).voteOnDispute(1, 2); // VoteFor.CLIENT
        await escrow3.connect(arbitrators[16]).voteOnDispute(1, 2); // VoteFor.CLIENT

        expect(await escrow3.state()).to.equal(4); // DISSOLVED
        
        ///////////////////////// When it is resolved, no one can vote anymore, means not tokens for them; is that bad?????
        
    });

    /*

    it("Simulates arbitrator behavior and checks for potential exploitation", async function () {
        const totalPayment = "20";
        const projectDescription = "Create a smart contract";

        const escrow = await createEscrow(client, freelancer, paymentAmount, projectDescription);

        // Deposit by client
        await escrow.connect(client).makeDeposit({ value: ethers.parseEther(paymentAmount) });

        // Raise a dispute
        const tx = await escrow.connect(client).raiseDispute("Incomplete project");
        const receipt = await tx.wait();
        const disputeEvent = receipt.events.find(event => event.event === 'DisputeRaised');
        const disputeID = disputeEvent.args.id;

        // Arbitrators with higher reputation
        await governanceToken.connect(owner).increaseReputation(arbitrators[0].address);
        await governanceToken.connect(owner).increaseReputation(arbitrators[0].address);

        // Arbitrators with different strategies
        await governanceToken.connect(arbitrators[0]).approve(escrow.target, ethers.parseEther("1")); // Honest voting
        await governanceToken.connect(arbitrators[1]).approve(escrow.target, ethers.parseEther("1")); // Random voting

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
    */
});
