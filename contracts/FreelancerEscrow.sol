// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.0;

contract FreelancerEscrow {
    address public client;
    address public freelancer;
    uint256 public totalPayment;
    string public projectDescription;
    string public completionMessage;

    enum EscrowState { AWAITING_DEPOSIT, AWAITING_DELIVERY, COMPLETED, CONFIRMED, DISPUTE }
    EscrowState public state = EscrowState.AWAITING_DEPOSIT;

    event DepositMade(address indexed client, uint256 amount);
    event DeliverableCompleted(address indexed freelancer, string message);
    event DeliveryConfirmed(address indexed client, address indexed freelancer);
    event PaymentMade(address indexed freelancer, uint256 amount);

    constructor(
        address _client,
        address _freelancer,
        uint256 _totalPayment,
        string memory _projectDescription
    ) {
        require(_totalPayment > 0, "Amount must be greater than zero");

        client = _client;
        freelancer = _freelancer;
        totalPayment = _totalPayment;
        projectDescription = _projectDescription;
    }

    function makeDeposit() external payable {
        require(msg.sender == client, "Only client can perform this action");
        require(msg.value == totalPayment, "Incorrect payment amount");
        require(state == EscrowState.AWAITING_DEPOSIT, "Invalid state for this action");

        state = EscrowState.AWAITING_DELIVERY;
        emit DepositMade(client, totalPayment);
    }

    function completedDeliverable(string calldata message) external {
        require(msg.sender == freelancer, "Only freelancer can perform this action");
        require(state == EscrowState.AWAITING_DELIVERY, "Invalid state for this action");

        completionMessage = message;
        state = EscrowState.COMPLETED;
        emit DeliverableCompleted(freelancer, message);
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


}