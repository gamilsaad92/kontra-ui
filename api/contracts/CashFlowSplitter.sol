// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title CashFlowSplitter
/// @notice Routes borrower repayments to participation token holders.
contract CashFlowSplitter is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable participationToken;
    address public servicer;

    event CashflowReceived(address indexed payer, uint256 amount, uint256 recordedAt);
    event DistributionExecuted(uint256 amount, uint256 atBlock, uint256 holdersProcessed);
    event ServicerUpdated(address indexed servicer);

    constructor(IERC20 participationToken_, address owner_) Ownable(owner_) {
        participationToken = participationToken_;
        servicer = owner_;
    }

    modifier onlyServicer() {
        require(msg.sender == servicer || msg.sender == owner(), "NOT_SERVICER");
        _;
    }

    function setServicer(address newServicer) external onlyOwner {
        servicer = newServicer;
        emit ServicerUpdated(newServicer);
    }

    function recordCashflow(uint256 amount) external onlyServicer {
        emit CashflowReceived(msg.sender, amount, block.timestamp);
    }

    /// @dev Simple proportional distribution assuming holders snapshot on demand.
    function distribute(address[] calldata holders) external onlyServicer {
        uint256 supply = participationToken.totalSupply();
        uint256 balance = participationToken.balanceOf(address(this));
        if (supply == 0 || balance == 0 || holders.length == 0) {
            return;
        }

        for (uint256 i = 0; i < holders.length; i++) {
            address holder = holders[i];
            uint256 holderBalance = participationToken.balanceOf(holder);
            if (holderBalance == 0) continue;
            uint256 share = (balance * holderBalance) / supply;
            participationToken.safeTransfer(holder, share);
        }

        emit DistributionExecuted(balance, block.number, holders.length);
    }
}
