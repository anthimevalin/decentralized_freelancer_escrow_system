const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("Governance Token Contract", function () {
    let arbitrator1, arbitrator2, arbitrator3, governanceToken;

    beforeEach(async function () {
        [arbitrator1, arbitrator2, arbitrator3] = await ethers.getSigners(); // Get test accounts

        const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
        governanceToken = await GovernanceToken.deploy();
        await governanceToken.waitForDeployment();
   
    });
    it("Should add arbitrator with 10 tokens and 1 reputation point in balance", async function () {
        await governanceToken.addArbitrator(arbitrator1.address);
        await governanceToken.addArbitrator(arbitrator2.address);
        expect(await governanceToken.balanceOf(arbitrator1.address)).to.equal(10);
        expect(await governanceToken.reputation(arbitrator1.address)).to.equal(1);
    });

    it("Length of all arbitrators should be 2", async function () {
        await governanceToken.addArbitrator(arbitrator1.address);
        await governanceToken.addArbitrator(arbitrator2.address);
        expect(await governanceToken.getAllArbitrators()).to.have.lengthOf(2);
    });
    
/*
    it("Should return a random sample of arbitrators with correct weights", async function () {
        // Add arbitrators
        await governanceToken.addArbitrator(arbitrator1.address);
        await governanceToken.addArbitrator(arbitrator2.address);
        await governanceToken.addArbitrator(arbitrator3.address);

    
        // Increase reputation to create weight differences
        // arbitrator3 has 1 reputation
        await governanceToken.increaseReputation(arbitrator1.address); // Arbitrator1 reputation: 2
        await governanceToken.increaseReputation(arbitrator2.address); // Arbitrator2 reputation: 2
        await governanceToken.increaseReputation(arbitrator2.address); // Arbitrator2 reputation: 3
    
        // Get all arbitrators and their reputations
        const allArbitrators = await governanceToken.getAllArbitrators();
        const arbitrator1Reputation = await governanceToken.getReputation(arbitrator1.address);
        const arbitrator2Reputation = await governanceToken.getReputation(arbitrator2.address);
        const arbitrator3Reputation = await governanceToken.getReputation(arbitrator3.address);
    
        // Confirm that reputations are correctly set
        expect(arbitrator1Reputation).to.equal(2);
        expect(arbitrator2Reputation).to.equal(3);
        expect(arbitrator3Reputation).to.equal(1);
    
        // Request a random sample of size 1
        const sampleSize = 2;
        const sample = await governanceToken.getRandomSampleOfArbitrators(sampleSize);
    
        // Validate the sample size
        expect(sample).to.have.lengthOf(sampleSize);
    
        // Ensure the sampled address belongs to the list of all arbitrators
        expect(allArbitrators).to.include.members(sample);
    
        // Run statistical checks (optional, depending on the test requirements)
        // Repeat the sampling and verify that higher reputation arbitrators appear more frequently
        // For simplicity we only consider one sample
        const iterations = 10000;
        const selectionCounts = {};
        for (let i = 0; i < iterations; i++) {
            const singleSample = await governanceToken.getRandomSampleOfArbitrators(1);
            const selected = singleSample[0];
            selectionCounts[selected] = (selectionCounts[selected] || 0) + 1;
        }
    
        // Ensure that every arbitrator has been selected at least once
        expect(selectionCounts).to.have.keys([
            arbitrator1.address,
            arbitrator2.address,
            arbitrator3.address,
        ]);
    
        // Arbitrators with higher reputation should be selected more often
        expect(selectionCounts[arbitrator2.address]).to.be.greaterThan(selectionCounts[arbitrator1.address]);
        expect(selectionCounts[arbitrator1.address]).to.be.greaterThan(selectionCounts[arbitrator3.address]);
    });
*/

});