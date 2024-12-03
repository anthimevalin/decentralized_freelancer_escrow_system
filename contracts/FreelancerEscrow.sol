// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.20;
import "./GovernanceToken.sol";


import "hardhat/console.sol";

contract FreelancerEscrow {
    address public client;
    address public freelancer;
    address public corp;
    //address [] public arbitrators;
    uint256 public totalPayment;
    string public projectDescription;
    string public completionMessage;
    uint256 public milestoneCount;
    uint256 public nextPayment;
    uint256 public paymentMade;
    uint256 public commissionRate = 5;

    uint256 public milestoneCompleted;

    GovernanceToken public governanceToken;

    enum VoteFor { NONE, FREELANCER, CLIENT }

    enum EscrowState { AWAITING_DEPOSIT, AWAITING_DELIVERABLE, AWAITING_APPROVAL, COMPLETED, CONFIRMED, DISSOLVED }
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
    event MilestoneCompleted(address indexed freelancer, address indexed client, string message);
    event MilestoneConfirmed(address indexed client, address indexed freelancer, uint256 amount);

    constructor(
        address _client,
        address _freelancer,
        uint256 _totalPayment,
        string memory _projectDescription,
        address _governanceToken,
        uint256 _milestoneCount
    ) {
        require(_totalPayment > 0, "Amount must be greater than zero");
        client = _client;
        freelancer = _freelancer;
        totalPayment = _totalPayment;
        projectDescription = _projectDescription;
        governanceToken = GovernanceToken(_governanceToken);
        milestoneCount = _milestoneCount;
        nextPayment = 0;
        paymentMade = 0;
        milestoneCompleted = 0;
        corp = 0x4F259744634C65F2e2cFe70bAF3C0EA04640631b;
    }


    function makeDeposit(uint256 depositAmount) external payable {
        require(msg.sender == client, "Only client can perform this action");
        require(state == EscrowState.AWAITING_DEPOSIT, "Invalid state for this action");

        if (milestoneCompleted == milestoneCount) {
            depositAmount = (totalPayment - paymentMade);
        }

        // Calculate the commission fee
        uint256 commissionFee = depositAmount * commissionRate / 100;

        // Calculate the total payment required
        uint256 requiredPayment = depositAmount + commissionFee;

        // Ensure the client has sent the correct total payment
        require(msg.value == requiredPayment, "Incorrect payment amount");

        // Update contract state and emit event
        state = EscrowState.AWAITING_DELIVERABLE;
        nextPayment = depositAmount;

        emit DepositMade(client, freelancer, depositAmount);
    }

    function completedMilestone(string calldata message) external {
        require(msg.sender == freelancer, "Only freelancer can perform this action");
        require(state == EscrowState.AWAITING_DELIVERABLE, "Invalid state for this action");

        completionMessage = message;
        

        if (milestoneCompleted == milestoneCount) {
            state = EscrowState.COMPLETED;
            emit DeliverableCompleted(freelancer, client, message);
        } else {
            state = EscrowState.AWAITING_APPROVAL;
            emit MilestoneCompleted(freelancer, client, message);
        }
        milestoneCompleted++;
    }

    function confirmMilestoneAndMakePayment() external {
        require(msg.sender == client || msg.sender == address(this), "Only client can perform this action");
        require(state == EscrowState.COMPLETED || state == EscrowState.AWAITING_APPROVAL, "Invalid state for this action");

        // Transfer funds to the freelancer
        payable(freelancer).transfer(nextPayment);
        emit PaymentMade(freelancer, totalPayment);
        paymentMade += nextPayment;

        if (state == EscrowState.COMPLETED) {
            state = EscrowState.CONFIRMED;
            emit DeliveryConfirmed(client, freelancer);
            payable(corp).transfer(address(this).balance);

            // Transfer governance tokens to the client and freelancer -- only adds tokens for the first conctract
            governanceToken.addArbitrator(client);
            governanceToken.addArbitrator(freelancer);
        } else {
            state = EscrowState.AWAITING_DEPOSIT;
            emit MilestoneConfirmed(client, freelancer, nextPayment);
            payable(corp).transfer(address(this).balance);
        }
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

        // As soon as 50% of the arbitrators have voted for one party, the dispute is resolved
        if (dispute.votesForFreelancer >= dispute.sampleSize / 2 || dispute.votesForClient >= dispute.sampleSize / 2) {
            resolveDispute(disputeId);
        }
    }

    function resolveDispute (uint256 disputeId) internal {
        require(disputeId > 0 && disputeId <= disputeCount, "Invalid dispute ID");
        
        require(address(this).balance >= nextPayment, "Insufficient contract balance");

        Dispute storage dispute = disputes[disputeId - 1];

        if (dispute.votesForFreelancer >= dispute.sampleSize / 2) {
            state = EscrowState.CONFIRMED;
            emit DisputeResolved(disputeId, freelancer, state, "Freelancer won the dispute");

            // Transfer funds to the freelancer
            payable(freelancer).transfer(nextPayment);

            emit DeliveryConfirmed(client, freelancer);
            emit PaymentMade(freelancer, nextPayment);

        } else {
            state = EscrowState.DISSOLVED;
            emit DisputeResolved(disputeId, client, state, "Client won the dispute");

            // Transfer funds back to the client
            payable(client).transfer(nextPayment);

            emit DepositRefunded(client, totalPayment);

        }
        // Give arbitrators money and token back
        uint256 votersCount = 0;
        for (uint256 i = 0; i < dispute.arbitrators.length; i++) {
            if (dispute.votes[dispute.arbitrators[i]] != VoteFor.NONE) {
                votersCount++;
            }
        }
        dispute.disputeState = DisputeState.RESOLVED;
        uint256 arbitrator_commission = (address(this).balance / votersCount) / 2;

        // Transfer governance tokens and comission to the arbitrators that voted for the freelancer#
        for (uint256 i = 0; i < dispute.arbitrators.length; i++) {
            if (dispute.votes[dispute.arbitrators[i]] != VoteFor.NONE) {
                governanceToken.transfer(dispute.arbitrators[i], 1);
                governanceToken.mint(dispute.arbitrators[i], 1);
                payable(dispute.arbitrators[i]).transfer(arbitrator_commission);
            }
        }
        payable(corp).transfer(address(this).balance);
    }

}