// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ParticipationToken
/// @notice ERC-20 representing fractional participations in a given loan.
contract ParticipationToken is ERC20, Ownable {
    uint256 public immutable loanId;
    address public splitter;

    event ParticipationMinted(address indexed to, uint256 amount, uint256 indexed loanId);
    event ParticipationBurned(address indexed from, uint256 amount, uint256 indexed loanId);
    event SplitterUpdated(address indexed splitter);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 loanId_,
        address owner_
    ) ERC20(name_, symbol_) Ownable(owner_) {
        loanId = loanId_;
    }

    function setSplitter(address splitter_) external onlyOwner {
        splitter = splitter_;
        emit SplitterUpdated(splitter_);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
        emit ParticipationMinted(to, amount, loanId);
    }

    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
        emit ParticipationBurned(from, amount, loanId);
    }
}
