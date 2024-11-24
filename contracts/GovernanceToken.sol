// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
// make sure: npm install @openzeppelin/contracts
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GovernanceToken is ERC20, Ownable {
    mapping(address => bool) public arbitrators;

    constructor() ERC20("GovernanceToken", "GT") Ownable(msg.sender) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function addArbitrator(address arbitrator) external onlyOwner {
        arbitrators[arbitrator] = true;
    }

    function removeArbitrator(address arbitrator) external onlyOwner {
        arbitrators[arbitrator] = false;
    }

    function isArbitrator(address account) external view returns (bool) {
        return arbitrators[account];
    }
}
