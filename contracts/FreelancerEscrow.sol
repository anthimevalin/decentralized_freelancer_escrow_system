// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.20;
import "./GovernanceToken.sol";


import "hardhat/console.sol";

contract FreelancerEscrow {
    address public client;
    address public freelancer;
    //address [] public arbitrators;
    uint256 public totalPayment;
    string public projectDescription;
    string public completionMessage;

    GovernanceToken public governanceToken;

    enum VoteFor { NONE, FREELANCER, CLIENT }

    enum EscrowState { AWAITING_DEPOSIT, AWAITING_DELIVERY, COMPLETED, CONFIRMED, DISSOLVED }
    EscrowState public state = EscrowState.AWAITING_DEPOSIT;
    
    enum DisputeState { RAISED, RESOLVED }

    struct Dispute {
        uint256 id;
        address raisedBy;
        EscrowState currentState;
        DisputeState disputeState;
        string message;
        uint256 votesForFreelancer;
        uint256 votesForClient;
        address[] arbitrators;
        uint256 sampleSize;
        mapping(address => VoteFor) votes; // Mapping of arbitrators to their votes - true for freelancer, false for client
    }

    Dispute[] public disputes; // Array of all disputes raised

    mapping(address => uint256[]) public disputesByParty;

    uint256 public disputeCount;

    event DisputeRaised(uint256 indexed id, address indexed raisedBy, EscrowState state, string message);
    event DisputeResolved(uint256 indexed id, address indexed resolvedBy, EscrowState state, string message);
    event DepositMade(address indexed client, address indexed freelancer, uint256 amount);
    event DeliverableCompleted(address indexed freelancer, address indexed client, string message);
    event DeliveryConfirmed(address indexed client, address indexed freelancer);
    event PaymentMade(address indexed freelancer, uint256 amount); //address indexed client????
    event VoteCast(uint256 indexed disputeId, address indexed voter, VoteFor newVote, uint256 amount);
    event DepositRefunded(address indexed client, uint256 amount);

    constructor(
        address _client,
        address _freelancer,
        uint256 _totalPayment,
        string memory _projectDescription,
        address _governanceToken
    ) {
        require(_totalPayment > 0, "Amount must be greater than zero");
        client = _client;
        freelancer = _freelancer;
        totalPayment = _totalPayment;
        projectDescription = _projectDescription;
        governanceToken = GovernanceToken(_governanceToken);
    }

    function makeDeposit() external payable {
        require(msg.sender == client, "Only client can perform this action");
        require(msg.value == totalPayment, "Incorrect payment amount");
        require(state == EscrowState.AWAITING_DEPOSIT, "Invalid state for this action");

        state = EscrowState.AWAITING_DELIVERY;
        emit DepositMade(client, freelancer, totalPayment);
    }

    function completedDeliverable(string calldata message) external {
        require(msg.sender == freelancer, "Only freelancer can perform this action");
        require(state == EscrowState.AWAITING_DELIVERY, "Invalid state for this action");

        completionMessage = message;
        state = EscrowState.COMPLETED;
        emit DeliverableCompleted(freelancer, client, message);
    }

    function confirmDeliveryAndMakePayment() external {
        require(msg.sender == client || msg.sender == address(this), "Only client can perform this action");
        require(state == EscrowState.COMPLETED, "Invalid state for this action");

        // Transfer funds to the freelancer
        payable(freelancer).transfer(totalPayment);

        state = EscrowState.CONFIRMED;

        emit DeliveryConfirmed(client, freelancer);
        emit PaymentMade(freelancer, totalPayment);

        // Transfer governance tokens to the client and freelancer
        governanceToken.addArbitrator(client);
        governanceToken.addArbitrator(freelancer);
    }

    // Check if an address is an arbitrator in the dispute
    function isArbitrator(address addr, uint256 disputeID) internal view returns (bool) {
        Dispute storage dispute = disputes[disputeID - 1];
        for (uint256 i = 0; i < dispute.arbitrators.length; i++) {
            if (dispute.arbitrators[i] == addr) {
                return true;
            }
        }
        return false;
}

    function raiseDispute(string calldata message) external {
        require(msg.sender == client || msg.sender == freelancer, "Only client or freelancer can perform this action");
        disputeCount++;
        Dispute storage newDispute = disputes.push();
        newDispute.id = disputeCount;
        newDispute.raisedBy = msg.sender;
        newDispute.currentState = state;
        newDispute.disputeState = DisputeState.RAISED;
        newDispute.message = message;
        newDispute.votesForFreelancer = 0;
        newDispute.votesForClient = 0;

        uint256 sampleSize = governanceToken.getAllArbitrators().length; // Eventually change to something logarithmic
        newDispute.sampleSize = sampleSize;

        newDispute.arbitrators = governanceToken.getAllArbitrators(); // governanceToken.getRandomSampleOfArbitrators(sampleSize);

        disputesByParty[msg.sender].push(disputeCount);

        emit DisputeRaised(disputeCount, msg.sender, state, message);
    }

    /*
    function getDisputesByParty(address party) external view returns (Dispute[] memory) {
        require(msg.sender == client || msg.sender == freelancer || isArbitrator(msg.sender), "Only client, freelancer, or arbitrator can perform this action");
        uint256[] memory disputeIds = disputesByParty[party]; // Get dispute IDs for the party
        Dispute[] memory result = new Dispute[](disputeIds.length); // Create a temporary array in memory

        for (uint256 i = 0; i < disputeIds.length; i++) {
            result[i] = disputes[disputeIds[i] - 1]; // Look up each dispute by its ID
        }

        return result; // Return the array of disputes
    }
    */

    // Function to vote on a dispute
    function voteOnDispute(uint256 disputeId, VoteFor newVote) external {
        require(disputeId > 0 && disputeId <= disputeCount, "Invalid dispute ID");
        
        Dispute storage dispute = disputes[disputeId - 1];
        if (dispute.disputeState == DisputeState.RESOLVED) {
            return;
        }
        require(msg.sender != client && msg.sender != freelancer, "Client and freelancer cannot vote");
        require(isArbitrator(msg.sender, disputeId), "Only arbitrators can vote");
        require(dispute.disputeState == DisputeState.RAISED, "Dispute already resolved");
        require(governanceToken.balanceOf(msg.sender) >= 1, "Must hold governance tokens to vote");
        require(dispute.votes[msg.sender] == VoteFor.NONE, "Cannot vote for the same dispute twice");

        governanceToken.transferFrom(msg.sender, address(this), 1);

        if (newVote == VoteFor.FREELANCER) {
            dispute.votesForFreelancer += 1;
            dispute.votes[msg.sender] = VoteFor.FREELANCER;
        } else if (newVote == VoteFor.CLIENT) {
            dispute.votesForClient += 1;
            dispute.votes[msg.sender] = VoteFor.CLIENT;
        }

        emit VoteCast(disputeId, msg.sender, newVote, 1);

        if (dispute.votesForFreelancer > dispute.sampleSize / 2 || dispute.votesForClient > dispute.sampleSize / 2) {
            resolveDispute(disputeId);
        }
    }

    function resolveDispute (uint256 disputeId) internal {
        require(disputeId > 0 && disputeId <= disputeCount, "Invalid dispute ID");
        
        require(address(this).balance >= totalPayment, "Insufficient contract balance");

        Dispute storage dispute = disputes[disputeId - 1];

        if (dispute.votesForFreelancer >= dispute.sampleSize / 2) {
            state = EscrowState.CONFIRMED;
            emit DisputeResolved(disputeId, freelancer, state, "Freelancer won the dispute");

            // Transfer funds to the freelancer
            payable(freelancer).transfer(totalPayment);

            emit DeliveryConfirmed(client, freelancer);
            emit PaymentMade(freelancer, totalPayment);

            // Transfer governance tokens to the arbitrators that voted for the freelancer#
            for (uint256 i = 0; i < dispute.arbitrators.length; i++) {
                if (dispute.votes[dispute.arbitrators[i]] == VoteFor.FREELANCER) {
                    governanceToken.mint(dispute.arbitrators[i], 2);
                    governanceToken.increaseReputation(dispute.arbitrators[i]);
                }
            }

        } else {
            state = EscrowState.DISSOLVED;
            emit DisputeResolved(disputeId, client, state, "Client won the dispute");

            // Transfer funds back to the client
            payable(client).transfer(totalPayment);

            emit DepositRefunded(client, totalPayment);

            // Transfer governance tokens to the arbitrators that voted for the freelancer#
            for (uint256 i = 0; i < dispute.arbitrators.length; i++) {
                if (dispute.votes[dispute.arbitrators[i]] == VoteFor.CLIENT) {
                    governanceToken.mint(dispute.arbitrators[i], 2);
                    governanceToken.increaseReputation(dispute.arbitrators[i]);
                }
            }
        }
        dispute.disputeState = DisputeState.RESOLVED;

    }

}