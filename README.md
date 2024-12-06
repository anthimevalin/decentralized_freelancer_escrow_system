# Decentralized Freelancer Escrow System
## Overview

This project consists of two smart contracts: FreelancerEscrow and GovernanceToken. Together, they create a decentralized escrow platform for freelance projects with dispute resolution via governance tokens.

### Main Features
1. Escrow Management:
    * Secures payments between a client and a freelancer for milestones in a project
    * Provides milestone-based payouts
    * Holds funds securely until milestones are completed (by freelancer) and approved (by clients)
    * Providers of the system (corp) receive a 5% commission on top of all deposits made by the client 
2. Dispute Resolution:
    * Disputes can be raised by either the client or freelancer
    * Arbitrators, selected from governance token holders, can vote on disputes by lending one of their tokens to the contract
    * Votes resolve disputes and redistribute funds appropriately
3. Governance Token Integration:
    * Arbitrators who are responsible for resolving disputes (i.e., voted) are rewarded with an extra governance token and receive half of the commission the providers of the system for a given milestone, evenly distributed across each arbitrator
    * Although not implemented, propose a pseudo-random reputation-weighted selection of arbitrators for higher-stake disputes

## Contract Details
### FreelancerEscrow Contract
#### Variables
* Addresses:
    * client: Address of the project client
    * freelancer: Address of the freelancer working on the project
    * corp: Address of service provider for commission payment
* Payments:
    * totalPayment: Total amount agreed for the whole project
    * nextPayment: Payments amount for the next milestone
    * paymentMade: Total payment made so far
* Milestones:
    * milestoneCount: Total number of milestones in the project
    * milestoneCompleted: Number of milestones completed so far
* State:
    * state: Current state of the escrow
    * disputes: List of disputes raised during the contract
* Governance Token:
    * governanceToken: Token used for dispute resolution and arbitrator selection
#### Key Functions
1. Milestone Management:
    * makeDeposit(uint256 depositAmount): Client deposits funds for the next milestone, paying an extra 5% for commisson to the corp
    * completedMilestone(string calldata message): Freelancer marks a milestone as complete
    * confirmMilestoneAndMakePayment(): Client approves and contract releases funds to the freelancer for a milestone
2. Dispute Management:
    * raiseDispute(string calldata message): Raise a dispute with a description
    * voteOnDispute(uint256 disputeId, VoteFor newVote): Arbitrators cast votes on an active dispute. Once 50% of the arbitrators have voted for one party, resolveDispute is called 
    * resolveDispute(uint256 disputeId): Resolves a dispute based on votes and releases funds to the winner and half of the service providers commission is distributed evenly across all arbitrators who voted on the dispute
3. Utility Functions:
    * isArbitrator(address addr, uint256 disputeId): Check if an address is an arbitrator for a dispute

### GovernanceToken Contract
#### Variables
* Arbitrators:
    * arbitrators: Mapping of arbitrator addresses
    * allArbitrators: List of all arbitrator addresses
    * reputation: Reputation score of arbitrators (it is important to note that an arbitrator's reputation has no functionality at the moment, however, is included to serve as a base for future improvements)

#### Key Functions
1. Token Management:
    * mint(address to, uint256 amount): Mint governance tokens
    * transfer(address to, uint256 value): Transfer tokens between accounts
2. Arbitrator Management:
    * addArbitrator(address arbitrator): Add a new arbitrator and mint tokens
    * removeArbitrator(address arbitrator): Remove an arbitrator
3. Reputation:
    * increaseReputation(address arbitrator): Increase the reputation of an arbitrator


## Example Workflow
1. Setup:
     * Client and freelancer get together off-chain and agree to make an escrow contract, specifying the address of who the client and the freelancer will be, the total payment, the number of milestones, and some project description.
     * Governance tokens are initialized, and arbitrators are added to the contract
2. Milestone Completion:
    * Client deposits a payment (agreed with the freelancer off-chain) to the contract plus a 5% tax for the service providers commission, for the first milestone
    * Freelancer completes the milestone and marks it as done
    * Client confirms the milestone and the contract releases payment
    * The last deposit for the last milestone is determined by what is left in the agreed payment initialized at the beginning of the contract
3. Dispute Resolution:
    * A dispute for a given milestone is raised by either party
    * Arbitrators vote on the dispute using one governance token
    * Funds are distributed based on the resolution outcome and all arbitrators who voted gain half of the commission distributed evenly
    * Abritrators who voted receive the token they lended for voting and receive an extra one


## Testing
Testing is broken down into two sections. The first is just basic unit testing for each of the two contracts, ensuring that all the functions in the contracts return what is expected, under various scenarios. The second is a large simulation of multiple contracts...

### Unit Testing
#### FreelancerEscrow
The tests verify the core functionality of the FreelancerEscrow smart contract, covering deposit handling, milestone management, dispute resolution, and payment flows.
##### Test Descriptions
1. Contract Initialization
   * Ensures that the contract initializes correctly with the expected state variables (client, freelancer, total payment, milestone count, and project description)
     
2. Deposit Functionality
   * Verifies the client can make deposits, ensuring that the deposit amount plus the commission fee is transferred from the client to the contract's balance
   * Ensures the relevant events are emitted and the contract's state changes to AWAITING_DELIVERABLE
   * Prevents unauthorized users (non-clients) can't make deposits
   * Ensures that the cumulative deposits match the total payment
     
3. Milestone Completion
   * Confirms that the freelancer can complete the current milestone with a completion message
   * Ensures the relevant events are emitted and the contract's state changes to AWAITING_APPROVAL or COMPLETED if the current milestone is the final one
   * Prevents unauthorized users (non-freelancers) to declare deliverables as completed
     
4. Payment and Confirmation
   * Verifies that the client can confirm the deliverables, transferring the payments from the contract to the freelancer
   * Ensures that the service providers (corp) receive their commission fee
   * Ensures the relevant events are emitted and the contract's state changes to AWAITING_DEPOSIT or CONFIRMED if the current milestone is the final one
   * Prevents unauthorized users (non-client) from confirming the deliverables
  
5. Dispute Management
   * Verifies that the client or freelancer can raise disputes with a message and storing the relevant details (e.g., who raised the dispute, the current state of the contract, the message, and the current votes for the client and freelancer which are initialized at 0 for each)
   * Simulate arbitrators voting on the dispute, resolving the disputes based on the voting outcome and making sure the proper token and fund are distributed to the arbitrators and the winning party
   * Prevents unauthorized users (non-arbitrators and the contract freelancer and client) to vote on disputes, and ensures the arbitrators can only vote if they have a sufficient token balance

#### GovernanceToken
The tests verify the core functionality of the GovernanceToken smart contract, focusing on arbitrator management and token allocation
##### Test Descriptions
1. Adding Arbitrators
   * Confirms that adding an arbitrator assigns them 1 governance token in their balance and 1 reputation point in the reputation mapping

2. Arbitrator List Length
   * Ensures the getAllArbitrators function correctly returns the total number of arbitrators in the system 

### Final Simulation Testing 
The final simulation test comprises two tests that cover the lifecycle of multiple escrow contracts including deposits, milestone completion, dispute resolution, and arbitrator voting. The tests uses randomized inputs to evaluate the systems' ability to handle real-world situations, ensuring robustness and scalability (see test_output.log for the logs of the tests)
#### Test 1: Successful Completion of Multiple Contracts With and Without Disputes
##### Overview
This test simulation the end-to-end lifecycle of multiple FreelancerEscrow contracts with a randomized number of contracts that consist of disputes and no disputes

##### Key Steps:
1. Setup:
   * Deploys 20 FreelancerEscrow contracts, each linked to a different client and freelancer, with randomized payment amounts and milestone counts
   * Deploys the GovernanceToken contract, and assigns 50 arbitrators with a randomized token balance

2. Contract Interactions:
   * Clients make deposits for milestone
   * Freelancer completes the milestone
   * Contracts, that are randomly assigned as ones with a dispute at some point, raise a dispute by either the client or freelancer at a random milestone

3. Dispute Resolution:
   * Arbitrators randomly select a party to vote for
   * The winner is determined once 50% of the arbitrators have voted on one party
   * Once the winner is declared, any arbitrators that attempts to vote on the dispute are rejected
   * The funds are distributed to the winning party, with half of the 5% commission being distributed evenly amongst the arbitrators who were involved in resolving the dispute (i.e., arbitrators who voted), and the other half being distributed to the service provider

4. Completion:
   * Ensures the states of the contracts are transitioned to either COMPLETED or DISSOLVED

##### Outputs (See details on test_ouput.log)
* Logs all the deposits, milestone completions, disputes raised, and resolutions
* Log tables outlining the details of each of the contracts, the arbitrators, and summaries of the contracts' progress and arbitrator actions 
* Validates that all contracts reach a resolved state (COMPLETED or DISSOLVED)

#### Test 2: Concurrent Contract Interactions and Arbitrator Voting
##### Overview 
This test focuses on the robustness and correctness of the system under multiple simultaneous interactions across multiple contracts, allowing arbitrators to vote on multiple disputes concurrently

##### Key steps
1. Setup:
   * Same initialization process as Test 1

2. Contract Interaction:
   * Clients make deposits for milestone
   * Freelancer completes the milestone
   * Either the client or freelancer raises at a random milestone
  
3. Voting:
   * Each arbitrator attempts to vote on disputes across multiple contracts
   * Ensures that only arbitrators with tokens can vote and that a vote is only valid for unresolved disputes
   * Tracks which contracts each arbitrator votes on

##### Outputs (See details on test_ouput.log)
* Logs showing arbitrators' attempts to vote and failure to vote because of either insufficient token balance or voting on an already resolved dispute
* Log tables of arbitrators' voting details, including token and wallet balances, and contracts they were able to vote on
* List of the unresolved contracts (empty if all contracts happen to be resolved)

## Future work
* Make use of the reputation points in determining a random subset of arbitrators for a given contract weighted by an arbitrators' reputation point, favoring arbitrators with higher reputations for higher-stake disputes (i.e., contracts with larger payments)
* Introduce some off-chain platform allowing for easier communication between parties, an easier sharing of project details, and a forum, of some sort, for arbitrators to discuss and critique other arbitrators
* Some algorithm that continuously updates an arbitrators reputation based on multiple factors, including the number of disputes they have participated in and their level of suspicious activity in their voting patterns
* Including some time-based deadline, either on-chain or off-chain
* Improving the mechanism for determining the winner of a dispute, to avoid the situation where arbitrators choose not to vote, leaving the dispute unresolved 

