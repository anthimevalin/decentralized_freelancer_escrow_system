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
  * Arbitrators who are responsible for resolving disputes (i.e., voted) are rewarded with governance tokens and receive half of the commission the providers of the system for a given milestone, evenly distributed across each arbitrator
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
  * makeDeposit(uint256 depositAmount): Client deposits funds for the next milestone, paying an extra 5% for commission to the corp
  * completedMilestone(string calldata message): Freelancer marks a milestone as complete
  * confirmMilestoneAndMakePayment(): Client approves and contract releases funds to the freelancer for a milestone
2. Dispute Management:
  * raiseDispute(string calldata message): Raise a dispute with a description
  * voteOnDispute(uint256 disputeId, VoteFor newVote): Arbitrators cast votes on an active dispute. Once 50% of the arbitrators have voted for one party, resolveDispute is called (WHAT IF A TIE??)
  * resolveDispute(uint256 disputeId): Resolves a dispute based on votes and releases funds to the winner and half of the service providers commission is distributed evenly across all arbitrators who voted on the dispute
3. Utility Functions:
  * isArbitrator(address addr, uint256 disputeId): Check if an address is an arbitrator for a dispute

### GovernanceToken Contract
#### Variables
* Arbitrators:
  * arbitrators: Mapping of arbitrator addresses
  * allArbitrators: List of all arbitrator addresses
  * reputation: Reputation score of arbitrators

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
   * Client and freelacer get together off-chain and agree to make an escrow contract, specifying the payment, milestones, and project details
   * Governance tokens are initialized, and arbitrators are added to the contract
2. Milestone Completion:
  * Client deposits a payment (agreed with the freelancer off-chain) to the contract plus a 5% tax for the service providers commission, for the first milestone
  * Freelancer completes the milestone and marks it as done
  * Client confirms the milestone and the contract releases payment
  * The last payment for the last milestone is determined by what is left in the agreed payment initialized at the beginning of the contract
3. Dispute Resolution:
  * A dispute for a given milestone is raised by either party
  * Arbitrators vote on the dispute using one governance token
  * Funds are distributed based on the resolution outcome and all arbitrators who voted gain half of the commission distributed evenly


-------------------------------------------------------------------------------------
Achieved Milestone
* Unit Tests work
* The first tests kinda works
* Contracts now fully functional except Random Arbitrator selection
* Might have to make voting obligatory / remove reputation if someone doesn't vote to avoid people not wanting to vote on ambiguous contracts -- but complicated since sometimes just 50% of the arbitrators have to vote to resolve the dispute


Next steps
* Question about how arbitrators get the necessary info to cast a vote --> Request info function and log everything
* Implement milestones
* Fees
* New concept for the voting and governance tokens
* Have a look at deadlines in the blockchain
* How should we decide when a vote ends and who participates? -- Randomized arbitrator selection not working, should arbitrators declare their interest in a vote? --> Low reputation only for small contracts and vice versa for large contracts


Comments for the report
+ Info exchange would happen off-chain
+ Ideally, there would be an app as a framework


FINAL TEST
+  Arbitrators can only concurrently vote on one dispute for each token they have
+  Log balances after multiple contracts
+  Log governance tokens after multiple contracts
