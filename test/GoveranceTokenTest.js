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
    it("Should add arbitrator with 1 tokens and 1 reputation point in balance", async function () {
        await governanceToken.addArbitrator(arbitrator1.address);
        await governanceToken.addArbitrator(arbitrator2.address);
        expect(await governanceToken.balanceOf(arbitrator1.address)).to.equal(1);
        expect(await governanceToken.reputation(arbitrator1.address)).to.equal(1);
    });

    it("Length of all arbitrators should be 2", async function () {
        await governanceToken.addArbitrator(arbitrator1.address);
        await governanceToken.addArbitrator(arbitrator2.address);
        expect(await governanceToken.getAllArbitrators()).to.have.lengthOf(2);
    });

});