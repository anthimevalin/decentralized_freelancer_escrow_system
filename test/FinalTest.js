// test/FreelancerEscrow.test.js

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FreelancerEscrow", function () {
    let FreelancerEscrow, freelancerEscrow;
    let GovernanceToken, governanceToken;
    let owner;
    let accounts;
    let client, freelancer;
    let arbitrators = [];
    const NUM_ARBITRATORS = 50;
    const NUM_CONTRACTS = 10;
    let arbitratorData = []; // Array to store arbitrator info
    let corpAddress;

    beforeEach(async function () {
        // Get the list of accounts
        accounts = await ethers.getSigners();

        // Assign roles
        client = accounts[0];
        freelancer = accounts[1];
        owner = accounts[2];

        // The rest of the accounts will be arbitrators
        arbitrators = accounts.slice(3, 3 + NUM_ARBITRATORS);

        // Ensure we have enough accounts
        if (arbitrators.length < NUM_ARBITRATORS) {
            throw new Error(`Not enough accounts. Need at least ${3 + NUM_ARBITRATORS} accounts.`);
        }

        // Deploy the GovernanceToken contract
        GovernanceToken = await ethers.getContractFactory("GovernanceToken");
        governanceToken = await GovernanceToken.connect(owner).deploy();
        await governanceToken.waitForDeployment();

        // Mint varying amounts of governance tokens to arbitrators and assign strategies
        for (let i = 0; i < arbitrators.length; i++) {
            let arbitrator = arbitrators[i];
            let tokenAmount = i % 10; // Tokens between 1 and 100
            await governanceToken.addArbitrator(arbitrator.address);
            await governanceToken.mint(arbitrator.address, tokenAmount);
            
            // Assign voting strategies: 0 - always freelancer, 1 - always client, 2 - random
            let strategy = i % 3;
            arbitratorData.push({
                account: arbitrator,
                strategy: strategy,
                tokens: tokenAmount,
            });
        }
    });

    it("should simulate contracts with disputes and arbitrator voting", async function () {
        // The corp address is hardcoded in the contract
        corpAddress = "0x4F259744634C65F2e2cFe70bAF3C0EA04640631b";

        for (let i = 0; i < NUM_CONTRACTS; i++) {
            console.log(`\nContract ${i + 1}:\n`);

            // Deploy a new instance of FreelancerEscrow
            let totalPayment = ethers.parseEther("10"); // 10 ETH for example
            let milestoneCount = 1; // Single milestone for simplicity
            FreelancerEscrow = await ethers.getContractFactory("FreelancerEscrow");
            freelancerEscrow = await FreelancerEscrow.deploy(
                client.address,
                freelancer.address,
                totalPayment,
                `Project description ${i + 1}`,
                governanceToken.target,
                milestoneCount
            );
            await freelancerEscrow.waitForDeployment();

            // Client makes a deposit
            let depositAmount = totalPayment;
            let commissionRate = await freelancerEscrow.commissionRate();
            let commissionFee = depositAmount * BigInt(commissionRate) / BigInt(100);
            let requiredPayment = depositAmount + BigInt(commissionFee);
            await freelancerEscrow
                .connect(client)
                .makeDeposit(depositAmount, { value: requiredPayment });

            // Freelancer completes the milestone
            await freelancerEscrow
                .connect(freelancer)
                .completedMilestone(`Completion message for contract ${i + 1}`);

            // Client raises a dispute
            await freelancerEscrow
                .connect(client)
                .raiseDispute(`Dispute message for contract ${i + 1}`);

            // Get the dispute ID
            // let disputeCount = await freelancerEscrow.disputeCount();
            let disputeId = 1;

            // Simulate arbitrator voting
            // Since we cannot access dispute state directly, we'll use events and try-catch blocks

            // Create a flag to check if dispute is resolved
            let disputeResolved = false;

            for (let j = 0; j < arbitratorData.length; j++) {
                let arbitrator = arbitratorData[j];
                let account = arbitrator.account;
                let strategy = arbitrator.strategy;
                let tokensAvailable = await governanceToken.balanceOf(account.address);

                if (tokensAvailable == 0) {
                    // Skip if arbitrator has no tokens
                    continue;
                }

                // Approve the FreelancerEscrow contract to transfer tokens
                await governanceToken
                    .connect(account)
                    .approve(freelancerEscrow.target, 1);

                // Determine vote based on strategy
                let vote;
                if (strategy === 0) {
                    vote = 0; // VoteFor.FREELANCER
                } else if (strategy === 1) {
                    vote = 1; // VoteFor.CLIENT
                } else {
                    vote = j % 2; // Alternating vote
                }

                // Arbitrator votes
                try {
                    await freelancerEscrow.connect(account).voteOnDispute(disputeId, vote);
                } catch (err) {
                    // Dispute might be resolved or other error
                    continue;
                }

                // Check if dispute is resolved
                //if (disputeResolved) {
                //    arbitrator.tokens = (await governanceToken.balanceOf(account.address));
                //    break;
                //}
            }

            // Log balances and governance tokens after each contract
            let clientBalance = await ethers.provider.getBalance(client.address);
            let freelancerBalance = await ethers.provider.getBalance(freelancer.address);

            // Note: The corp address is hardcoded and may not be an account in our local network.
            let corpBalance = await ethers.provider.getBalance(corpAddress);

            console.log(`Client balance: ${ethers.formatEther(clientBalance)} ETH`);
            console.log(
                `Freelancer balance: ${ethers.formatEther(freelancerBalance)} ETH`
            );
            console.log(`Corp balance: ${ethers.formatEther(corpBalance)} ETH`);

            // Log arbitrators' governance tokens
            for (let j = 0; j < arbitratorData.length; j++) {
                let arbitrator = arbitratorData[j];
                let account = arbitrator.account;
                let strategy = arbitrator.strategy;
                let arbitratorBalance = await ethers.provider.getBalance(account.address);
                let tokens = await governanceToken.balanceOf(account.address);
                console.log(
                    `Arbitrator ${j + 1} ETH balance: ${ethers.formatEther(arbitratorBalance)} ETH tokens: ${tokens.toString()} Strategy: ${strategy}`
                );
            }
        }
    });
});
