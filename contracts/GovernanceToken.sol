// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
// make sure: npm install @openzeppelin/contracts
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GovernanceToken is ERC20, Ownable {
    mapping(address => bool) public arbitrators;
    mapping(address => uint256) public reputation;

    address[] public allArbitrators;

    constructor() ERC20("GovernanceToken", "GT") Ownable(msg.sender) {}

    function mint(address to, uint256 amount) external { //onlyOwner
        _mint(to, amount);
    }

    function isArbitrator(address account) external view returns (bool) {
        return arbitrators[account];
    }

    function getBalance(address account) external view returns (uint256) {
        return balanceOf(account);
    }

    function getReputation(address account) external view returns (uint256) {
        return reputation[account];
    }

    function getAllArbitrators() external view returns (address[] memory) {
        return allArbitrators;
    }

    function addArbitrator(address arbitrator) external { //onlyOwner
        if (!arbitrators[arbitrator]) {
            arbitrators[arbitrator] = true;
            _mint(arbitrator, 1);
            reputation[arbitrator] = 1;
            allArbitrators.push(arbitrator); 
        }
        
    }

    function removeArbitrator(address arbitrator) external onlyOwner {
        arbitrators[arbitrator] = false;
    }

    function increaseReputation(address arbitrator) external { //onlyOwner
        require(arbitrators[arbitrator], "Not an arbitrator");
        reputation[arbitrator]++;
    }
    

    function transfer(address to, uint256 value) public override returns (bool) {
        // Add custom logic here (e.g., additional validation or event logging)
        require(balanceOf(msg.sender) >= value, "Insufficient balance");

        // Call the parent contract's implementation
        return super.transfer(to, value);
    }

}
