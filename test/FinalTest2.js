const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FinalOverallTest", function () {
    let owner;
    let arbitrators = [];
    let arbitratorDetails = {};
    let contracts = [];
    const NUM_ARBITRATORS = 3;
    const NUM_CONTRACTS = 10;
    let clients = [];
    let freelancers = [];
    const corpAddress = "0x4F259744634C65F2e2cFe70bAF3C0EA04640631b";
    let governanceToken;

    beforeEach(async function () {
        arbitrators = [];
        contracts = [];
        clients = [];
        freelancers = [];
        arbitratorDetails = {};

        const signers = await ethers.getSigners();
        owner = signers[0];
        clients = signers.slice(1, 1 + NUM_CONTRACTS);
        freelancers = signers.slice(1 + NUM_CONTRACTS, 1 + 2*NUM_CONTRACTS);
        corp = corpAddress;
        //arbitrators = signers.slice(3, 3 + NUM_ARBITRATORS);
        arbitrators = signers.slice(1 + 2 * NUM_CONTRACTS, 1 + 2 * NUM_CONTRACTS + NUM_ARBITRATORS);



        const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
        governanceToken = await GovernanceToken.deploy();
        await governanceToken.waitForDeployment();
        // Add arbitrators to governanceToken
        for (let i = 0; i < arbitrators.length; i++) {
            let arbitrator = arbitrators[i];
            let tokenAmount = Math.floor(Math.random() * 10); // max 10 tokens in total
            await governanceToken.addArbitrator(arbitrator.address);
            await governanceToken.mint(arbitrator.address, tokenAmount);
            arbitratorDetails[arbitrator.address] = [];
            
        }

        // Create contracts
        for (let i = 0; i < NUM_CONTRACTS; i++) {
            const totalPayment = ethers.parseEther((10*Math.random()).toFixed(4));
            const milestoneCount = Math.floor(Math.random() * 5) + 1; 
            const FreelancerEscrow = await ethers.getContractFactory("FreelancerEscrow");
            const escrowContract = await FreelancerEscrow.deploy(
                clients[i].address,
                freelancers[i].address,
                totalPayment,
                `Project ${i + 1}`,
                governanceToken.target,
                milestoneCount
            );
            await escrowContract.waitForDeployment();
            contracts.push({ contract: escrowContract, totalAmount: totalPayment, client: clients[i].address, freelancer: freelancers[i].address, NumberOfMilestones: milestoneCount, description: `Project ${i + 1}`});        }   

        expect(arbitrators.length).to.equal(NUM_ARBITRATORS);
        expect(contracts.length).to.equal(NUM_CONTRACTS);
        expect(clients.length).to.equal(NUM_CONTRACTS);
        expect(freelancers.length).to.equal(NUM_CONTRACTS);
        expect(Object.keys(arbitratorDetails).length).to.equal(NUM_ARBITRATORS);
        

    });


    it("Should allow successful completion of multiple contracts including ones with disputes", async function () {
        expect(arbitrators.length).to.equal(NUM_ARBITRATORS);
        expect(contracts.length).to.equal(NUM_CONTRACTS);
        expect(clients.length).to.equal(NUM_CONTRACTS);
        expect(freelancers.length).to.equal(NUM_CONTRACTS);
        expect(Object.keys(arbitratorDetails).length).to.equal(NUM_ARBITRATORS);


        
        console.log("\n===========================");
        console.log("  ARBITRATOR INITIAL INFO ");
        console.log("===========================\n");
        for (i = 0; i < arbitrators.length; i++) {
            console.table([{ 
                [`arbitrator${i + 1}`]: arbitrators[i].address, 
                token_balance: await governanceToken.balanceOf(arbitrators[i].address), 
                wallet_balance: await ethers.provider.getBalance(arbitrators[i].address) 
            }]);
        }
        console.log("\n===========================");
        console.log(`  CONTRACT INFO `);
        console.log("===========================\n");
        for (i = 0; i < contracts.length; i++) {
            
            console.table([{ 
                [`contract${i + 1}`]: contracts[i].contract.target, 
                total_payment: contracts[i].totalAmount, 
                [`client${i + 1}`]: clients[i].address, 
                [`freelancer${i + 1}`]: freelancers[i].address,
                [`corp`]: corpAddress,
                milestoneCount: contracts[i].NumberOfMilestones,
                description: contracts[i].description 
            }]);
        }

        for (i = 0; i < contracts.length; i++) {
            const contract = contracts[i].contract;
            const client = clients[i];
            const freelancer = freelancers[i];
            const totalPayment = contracts[i].totalAmount;
            const milestoneCount = contracts[i].NumberOfMilestones;

            expect(await contract.client()).to.equal(client.address);
            expect(await contract.freelancer()).to.equal(freelancer.address);
            expect(await contract.totalPayment()).to.equal(totalPayment);
            expect(await contract.corp()).to.equal(corpAddress);
            expect(await contract.milestoneCount()).to.equal(milestoneCount);
            expect(await contract.projectDescription()).to.equal(`Project ${i + 1}`);
            expect(await contract.governanceToken()).to.equal(governanceToken.target);
            expect(await contract.state()).to.equal(0);
            expect(await ethers.provider.getBalance(contract.target)).to.equal(0);
            
            const hasDispute = Math.random() > 0.5; // 50% chance of a dispute
            const disputeMilestone = hasDispute ? (Math.floor(Math.random() * milestoneCount) + 1) : milestoneCount;            
            if (hasDispute) {
                for (j = 1; j < disputeMilestone; j++) {
                    // Client makes a despisit for milestone j
                    const depositAmount = BigInt(Math.floor(Number(totalPayment) / (2 * milestoneCount) * Math.random()));                    
                    const expectedCommission = depositAmount * BigInt(5) / BigInt(100);
                    const requiredPayment = depositAmount + expectedCommission;

                    await contract.connect(client).makeDeposit(depositAmount, { value: requiredPayment });

                    expect(await ethers.provider.getBalance(contract.target)).to.equal(requiredPayment);

                    console.log(`Client${i + 1} deposited ${depositAmount} Wei for milestone ${j} of contract ${i + 1}`);
                    console.log(`Contracts${i + 1} balance: ${await ethers.provider.getBalance(contract.target)} Wei and client${i + 1} balance: ${await ethers.provider.getBalance(client.address)} Wei`);

                    // Freelancer completes milestone j
                    await contract.connect(freelancer).completedMilestone(`Milestone ${j} Completed!`);
                    console.log(`${await contract.completionMessage()} of contract ${i + 1}`);

                    // Client confirms milestone j
                    await contract.connect(client).confirmMilestoneAndMakePayment();
                    console.log(`Client${i + 1} confirmed milestone ${j} of contract ${i + 1}`);
                    console.log(`Contracts${i + 1} balance: ${await ethers.provider.getBalance(contract.target)} Wei and freelancer${i + 1} balance: ${await ethers.provider.getBalance(freelancer.address)} Wei`);

                }
                const depositAmount = BigInt(Math.floor(Number(totalPayment) / (2 * milestoneCount) * Math.random()));                    
                let expectedCommission;
                let requiredPayment;
                const paymentMade = await contract.paymentMade();
                if (disputeMilestone == milestoneCount) {
                    expectedCommission = (totalPayment - paymentMade)* BigInt(5) / BigInt(100);
                    requiredPayment = totalPayment - paymentMade + expectedCommission;
                } else {
                    expectedCommission = depositAmount * BigInt(5) / BigInt(100);
                    requiredPayment = depositAmount + expectedCommission;
                }
                await contract.connect(client).makeDeposit(depositAmount, { value: requiredPayment });

                expect(await ethers.provider.getBalance(contract.target)).to.equal(requiredPayment);

                console.log(`Client${i + 1} deposited ${depositAmount} Wei for milestone ${j} of contract ${i + 1}`);
                console.log(`Contracts${i + 1} balance: ${await ethers.provider.getBalance(contract.target)} Wei and client${i + 1} balance: ${await ethers.provider.getBalance(client.address)} Wei`);

                const isClient = Math.random() < 0.5;
                if (isClient) {
                    console.log(`Client${i + 1} raised a dispute for milestone ${disputeMilestone} of contract ${i + 1}`);
                    await contract.connect(client).raiseDispute("Not happy with the work");
                } else {
                    console.log(`Freelancer${i + 1} raised a dispute for milestone ${disputeMilestone} of contract ${i + 1}`);
                    await contract.connect(freelancer).raiseDispute("Not happy with the work");
                }
                console.log("\n=======================================");
                console.log(` Contract${i+1} ARBITRATORS VOTES INFO `);
                console.log("=======================================\n");

                for (let k = 0; k < arbitrators.length; k++) {
                    const voteWho = Math.random() < 0.5 ? 1 : 2;
                    const arbitrator = arbitrators[k];
                    const initialArbitratorTokenBalances = await governanceToken.balanceOf(arbitrator.address);
                    const initialArbitratorBalances = await ethers.provider.getBalance(arbitrator.address);
                    await governanceToken.connect(arbitrator).approve(contract.target, 1);
                    if (await contract.state() == 1 || contract.state() == 2 || contract.state() == 3) {
                        await contract.connect(arbitrator).voteOnDispute(1, voteWho);
                    } else {
                        await expect(contract.connect(arbitrator).voteOnDispute(1, voteWho)).to.be.revertedWith("Invalid state for this action");
                        console.log(`Arbitrator${k + 1} could not vote on dispute for contract${i + 1} as the contract has been resolved`);
                    }
                    arbitratorDetails[arbitrator.address].push({
                        Contract: contract.target, 
                        InitialTokenBalance: initialArbitratorTokenBalances,
                        InitialBalance: initialArbitratorBalances,
                        VotedFor: voteWho == 1 ? "Freelancer" : "Client", 

                    });

                
                }
                for (let p = 0; p < arbitrators.length; p++) {
                    const arbitrator = arbitrators[p];
                
                    // Fetch final balances
                    const finalArbitratorTokenBalances = await governanceToken.balanceOf(arbitrator.address);
                    const finalArbitratorBalances = await ethers.provider.getBalance(arbitrator.address);
                    
                    if (arbitratorDetails[arbitrator.address].length > 0) {
                        const lastEntry = arbitratorDetails[arbitrator.address][arbitratorDetails[arbitrator.address].length - 1];
                        lastEntry.FinalTokenBalance = finalArbitratorTokenBalances;
                        lastEntry.FinalBalance = finalArbitratorBalances;
                    }
                
                }
                console.table(
                    Object.entries(arbitratorDetails).map(([address, entries]) => {
                        const latestEntry = entries[entries.length - 1]; // Get the latest entry for the address
                        return {
                            Arbitrator: address,
                            ...latestEntry
                        };
                    })
                );
             } else {
                for (j = 1; j <= milestoneCount; j++) {
                    // Client makes a despisit for milestone j
                    const depositAmount = BigInt(Math.floor(Number(totalPayment) / (2 * milestoneCount) * Math.random()));                    
                    let expectedCommission;
                    let requiredPayment;
                    const paymentMade = await contract.paymentMade();
                    if (j == milestoneCount) {
                        expectedCommission = (totalPayment - paymentMade)* BigInt(5) / BigInt(100);
                        requiredPayment = totalPayment - paymentMade + expectedCommission;
                    } else {
                        expectedCommission = depositAmount * BigInt(5) / BigInt(100);
                        requiredPayment = depositAmount + expectedCommission;
                    }
                    await contract.connect(client).makeDeposit(depositAmount, { value: requiredPayment });
                    
                    expect(await ethers.provider.getBalance(contract.target)).to.equal(requiredPayment);

                    console.log(`Client${i + 1} deposited ${depositAmount} Wei for milestone ${j} of contract ${i + 1}`);
                    console.log(`Contracts${i + 1} balance: ${await ethers.provider.getBalance(contract.target)} Wei and client${i + 1} balance: ${await ethers.provider.getBalance(client.address)} Wei`);
                    
                    // Freelancer completes milestone j
                    await contract.connect(freelancer).completedMilestone(`Milestone ${j} Completed!`);
                    console.log(`${await contract.completionMessage()} of contract ${i + 1}`);

                    // Client confirms milestone j
                    await contract.connect(client).confirmMilestoneAndMakePayment();
                    console.log(`Client${i + 1} confirmed milestone ${j} of contract ${i + 1}`);
                    console.log(`Contracts${i + 1} balance: ${await ethers.provider.getBalance(contract.target)} Wei and freelancer${i + 1} balance: ${await ethers.provider.getBalance(freelancer.address)} Wei`);
                    
                }
                expect(await contract.state()).to.equal(4); 
                console.log("------------------------------------------");
                console.log(`Contract ${i + 1} completed successfully`);
                console.log(`Final balance of contract${i + 1}: ${await ethers.provider.getBalance(contract.target)} Wei`);
                console.log(`Final balance of client${i + 1}: ${await ethers.provider.getBalance(client.address)} Wei`);
                console.log(`Final balance of freelancer${i + 1}: ${await ethers.provider.getBalance(freelancer.address)} Wei`);
                console.log("------------------------------------------");


            }
        }
    });

    it("Should allow successful completion of multiple concurrent contracts with disputes, tracking arbitrators' capabilities to vote on multiple disputes", async function () {
        console.log("\n===========================");
        console.log("CONCURRENT CONTRACTS");
        console.log("===========================\n");
    
        // Log initial arbitrator info
        console.log("\n===========================");
        console.log("  ARBITRATOR INITIAL INFO ");
        console.log("===========================\n");
        for (let i = 0; i < arbitrators.length; i++) {
            console.table([{ 
                [`arbitrator${i + 1}`]: arbitrators[i].address, 
                token_balance: await governanceToken.balanceOf(arbitrators[i].address), 
                wallet_balance: await ethers.provider.getBalance(arbitrators[i].address) 
            }]);
        }
    
        console.log("\n===========================");
        console.log(`  CONTRACT INFO `);
        console.log("===========================\n");
        for (i = 0; i < contracts.length; i++) {
            console.table([{ 
                [`contract${i + 1}`]: contracts[i].contract.target, 
                total_payment: contracts[i].totalAmount, 
                [`client${i + 1}`]: clients[i].address, 
                [`freelancer${i + 1}`]: freelancers[i].address,
                [`corp`]: corpAddress,
                milestoneCount: contracts[i].NumberOfMilestones,
                description: contracts[i].description 
            }]);
        }
    
        // Simulate contract milestones and disputes
        for (let i = 0; i < contracts.length; i++) {
            const contract = contracts[i].contract;
            const client = clients[i];
            const freelancer = freelancers[i];
            const totalPayment = contracts[i].totalAmount;
            const milestoneCount = contracts[i].NumberOfMilestones;
    
            const disputeMilestone = Math.floor(Math.random() * milestoneCount) + 1;
            for (let j = 1; j < disputeMilestone; j++) {
                const depositAmount = BigInt(Math.floor(Number(totalPayment) / (2 * milestoneCount) * Math.random()));                    
                const expectedCommission = depositAmount * BigInt(5) / BigInt(100);
                const requiredPayment = depositAmount + expectedCommission;
    
                await contract.connect(client).makeDeposit(depositAmount, { value: requiredPayment });
                await contract.connect(freelancer).completedMilestone(`Milestone ${j} Completed!`);
                await contract.connect(client).confirmMilestoneAndMakePayment();
            }
            
            const depositAmount = BigInt(Math.floor(Number(totalPayment) / (2 * milestoneCount) * Math.random()));                    
            let expectedCommission;
            let requiredPayment;
            const paymentMade = await contract.paymentMade();
            if (disputeMilestone == milestoneCount) {
                expectedCommission = (totalPayment - paymentMade)* BigInt(5) / BigInt(100);
                requiredPayment = totalPayment - paymentMade + expectedCommission;
            } else {
                expectedCommission = depositAmount * BigInt(5) / BigInt(100);
                requiredPayment = depositAmount + expectedCommission;
            }
            await contract.connect(client).makeDeposit(depositAmount, { value: requiredPayment });

            expect(await ethers.provider.getBalance(contract.target)).to.equal(requiredPayment);

            console.log(`Client${i + 1} deposited ${depositAmount} Wei for milestone ${j} of contract ${i + 1}`);
            console.log(`Contracts${i + 1} balance: ${await ethers.provider.getBalance(contract.target)} Wei and client${i + 1} balance: ${await ethers.provider.getBalance(client.address)} Wei`);

            const isClient = Math.random() < 0.5;
            if (isClient) {
                await contract.connect(client).raiseDispute("Not happy with the work");
            } else {
                await contract.connect(freelancer).raiseDispute("Not happy with the work");
            }
        }
    
        // Each arbitrator attempts to vote on all contracts
        for (let k = 0; k < arbitrators.length; k++) {
            const arbitrator = arbitrators[k];
            console.log(`\n=======================================`);
            console.log(` Arbitrator ${k + 1} Voting Process `);
            console.log("=======================================\n");
    
            // Track initial balances
            const initialArbitratorTokenBalance = await governanceToken.balanceOf(arbitrator.address);
            const initialArbitratorBalance = await ethers.provider.getBalance(arbitrator.address);
    
            let votedContracts = []; // Keep track of contracts where the arbitrator voted
    
            for (let i = 0; i < contracts.length; i++) {
                const contract = contracts[i].contract;
                const voteWho = Math.random() < 0.5 ? 1 : 2; // Randomly decide vote
                const currentTokenBalance = await governanceToken.balanceOf(arbitrator.address);
    
                console.log(`Arbitrator ${k + 1} is attempting to vote on Contract ${i + 1}`);
                if (currentTokenBalance > 0 && (await contract.state() == 1 || contract.state() == 2 || contract.state() == 3)) {
                    // Arbitrator has tokens to vote
                    await governanceToken.connect(arbitrator).approve(contract.target, 1); 
                    await contract.connect(arbitrator).voteOnDispute(1, voteWho); 
                    votedContracts.push(contract.target); 
                    console.log(`Arbitrator ${k + 1} successfully voted on Contract ${i + 1}`);
                } else if (currentTokenBalance == 0 && (await contract.state() == 1 || contract.state() == 2 || contract.state() == 3)) {
                    await expect(contract.connect(arbitrator).voteOnDispute(1, voteWho)).to.be.revertedWith("Must hold governance tokens to vote");
                    console.log(`Arbitrator ${k + 1} could not vote on Contract ${i + 1} due to lack of tokens`);
                } else {
                    await expect(contract.connect(arbitrator).voteOnDispute(1, voteWho)).to.be.revertedWith("Invalid state for this action");
                    console.log(`Arbitrator ${k + 1} could not vote on Contract ${i + 1} as the dispute was already resolved`);
                }
            }
    
            // Add voting details to arbitratorDetails
            arbitratorDetails[arbitrator.address].push({
                InitialTokenBalance: initialArbitratorTokenBalance,
                InitialBalance: ethers.formatEther(initialArbitratorBalance),
                VotedContracts: votedContracts.join(", "), // List of contracts arbitrator successfully voted on
            });
        }
    
        
    
        for (let k = 0; k < arbitrators.length; k++) {
            const arbitrator = arbitrators[k];
            const finalArbitratorTokenBalance = await governanceToken.balanceOf(arbitrator.address);
            const finalArbitratorBalance = await ethers.provider.getBalance(arbitrator.address);
    
            arbitratorDetails[arbitrator.address].forEach((entry) => {
                entry.FinalTokenBalance = finalArbitratorTokenBalance;
                entry.FinalBalance = ethers.formatEther(finalArbitratorBalance);
            });
        }
    
        // Calculate final balances and unresolved contracts at the end
        let incompleteContracts = [];
        for (let i = 0; i < contracts.length; i++) {
            const contract = contracts[i].contract;
            const state = await contract.state();
            if (state != 4 && state != 5) {
                incompleteContracts.push(`Contract ${i + 1}`);
            }
        }

        // Display unresolved contracts
        console.log("\n===========================");
        console.log("UNRESOLVED CONTRACTS");
        console.log("===========================\n");
        if (incompleteContracts.length > 0) {
            console.table(incompleteContracts);
        } else {
            console.log("All contracts have been resolved!");
        }
    
        // Display final results
        console.log("\n===========================");
        console.log("FINAL ARBITRATOR DETAILS");
        console.log("===========================\n");
        console.table(
            Object.entries(arbitratorDetails).map(([address, entries]) => {
                const latestEntry = entries[entries.length - 1];
                return {
                    Arbitrator: address,
                    ...latestEntry,
                };
            })
        );
    });    
    
});