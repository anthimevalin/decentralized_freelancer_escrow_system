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
        require(!arbitrators[arbitrator], "Already an arbitrator");
        arbitrators[arbitrator] = true;
        _mint(arbitrator, 1);
        reputation[arbitrator] = 1;
        allArbitrators.push(arbitrator);
    }

    function removeArbitrator(address arbitrator) external onlyOwner {
        arbitrators[arbitrator] = false;
    }

    function increaseReputation(address arbitrator) external { //onlyOwner
        require(arbitrators[arbitrator], "Not an arbitrator");
        reputation[arbitrator]++;
    }
    

    function getRandomSampleOfArbitrators(uint256 sampleSize) external view returns (address[] memory) {
        require(sampleSize <= allArbitrators.length, "Sample size exceeds number of arbitrators");

        address[] memory sample = new address[](sampleSize);
        uint256[] memory cumulativeWeights = new uint256[](allArbitrators.length);
        uint256 totalWeight = 0;

        for (uint256 i = 0; i < allArbitrators.length; i++) {
            totalWeight += reputation[allArbitrators[i]];
            cumulativeWeights[i] = totalWeight;
        }

        for (uint256 i = 0; i < sampleSize; i++) {
            uint256 randomWeight = uint256(keccak256(abi.encodePacked(i))) % totalWeight;
            for (uint256 j = 0; j < cumulativeWeights.length; j++) {
                if (randomWeight < cumulativeWeights[j]) {
                    sample[i] = allArbitrators[j];
                    break;
                }
            }
        }

        return sample;
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        // Add custom logic here (e.g., additional validation or event logging)
        require(balanceOf(msg.sender) >= value, "Insufficient balance");

        // Call the parent contract's implementation
        return super.transfer(to, value);
    }

}
