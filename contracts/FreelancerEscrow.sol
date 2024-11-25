// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.20;
import "./GovernanceToken.sol";


contract FreelancerEscrow {
    address public client;
    address public freelancer;
    //address [] public arbitrators;
    uint256 public totalPayment;
    string public projectDescription;
    string public completionMessage;

    GovernanceToken public governanceToken;


    enum EscrowState { AWAITING_DEPOSIT, AWAITING_DELIVERY, COMPLETED, CONFIRMED }
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
    event VoteCast(uint256 indexed disputeId, address indexed voter, bool voteForFreelancer, uint256 amount);

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
        require(msg.sender == client, "Only client can perform this action");
        require(state == EscrowState.COMPLETED, "Invalid state for this action");

        // Transfer funds to the freelancer
        payable(freelancer).transfer(totalPayment);

        state = EscrowState.CONFIRMED;

        emit DeliveryConfirmed(client, freelancer);
        emit PaymentMade(freelancer, totalPayment);
    }

    // Check if an address is an arbitrator
    function isArbitrator(address arbitrator) public view returns (bool) {
        return governanceToken.isArbitrator(arbitrator);
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

        disputesByParty[msg.sender].push(disputeCount);

        emit DisputeRaised(disputeCount, msg.sender, state, message);
    }

    function getDisputesByParty(address party) external view returns (Dispute[] memory) {
        require(msg.sender == client || msg.sender == freelancer || isArbitrator(msg.sender), "Only client, freelancer, or arbitrator can perform this action");
        uint256[] memory disputeIds = disputesByParty[party]; // Get dispute IDs for the party
        Dispute[] memory result = new Dispute[](disputeIds.length); // Create a temporary array in memory

        for (uint256 i = 0; i < disputeIds.length; i++) {
            result[i] = disputes[disputeIds[i] - 1]; // Look up each dispute by its ID
        }

        return result; // Return the array of disputes
    }

    // Function to vote on a dispute
    function voteOnDispute(uint256 disputeId, bool voteForFreelancer, uint256 amount) external {
        require(disputeId > 0 && disputeId <= disputeCount, "Invalid dispute ID");
        Dispute storage dispute = disputes[disputeId - 1];

        require(msg.sender != client && msg.sender != freelancer, "Client and freelancer cannot vote");
        require(isArbitrator(msg.sender), "Only arbitrators can vote");
        require(dispute.disputeState == DisputeState.RAISED, "Dispute already resolved");
        require(governanceToken.balanceOf(msg.sender) >= amount, "Must hold governance tokens to vote");
        require(amount > 0, "Amount must be greater than zero");

        governanceToken.transferFrom(msg.sender, address(this), amount);

        if (voteForFreelancer) {
            dispute.votesForFreelancer += amount;
        } else {
            dispute.votesForClient += amount;
        }

        emit VoteCast(disputeId, msg.sender, voteForFreelancer, amount);
    }

}