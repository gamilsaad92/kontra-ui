// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title LoanToken
/// @notice Minimal ERC-721 representing whole loan positions with servicer metadata.
contract LoanToken is ERC721, Ownable {
    struct LoanMetadata {
        string borrower;
        uint256 principal;
        uint256 couponBps;
        string status;
        string uri;
    }

    mapping(uint256 => LoanMetadata) private _loanData;

    event LoanRegistered(uint256 indexed loanId, address indexed owner, uint256 principal, uint256 couponBps, string borrower);
    event LoanStatusUpdated(uint256 indexed loanId, string previousStatus, string newStatus);
    event ServicerUriUpdated(uint256 indexed loanId, string previousUri, string newUri);

    constructor(address initialOwner) ERC721("Kontra Loan", "KLOAN") Ownable(initialOwner) {}

    function mint(
        address to,
        uint256 loanId,
        LoanMetadata calldata metadata
    ) external onlyOwner {
        _mint(to, loanId);
        _loanData[loanId] = metadata;
        emit LoanRegistered(loanId, to, metadata.principal, metadata.couponBps, metadata.borrower);
    }

    function updateStatus(uint256 loanId, string calldata newStatus) external onlyOwner {
        string memory prev = _loanData[loanId].status;
        _loanData[loanId].status = newStatus;
        emit LoanStatusUpdated(loanId, prev, newStatus);
    }

    function updateServicerUri(uint256 loanId, string calldata newUri) external onlyOwner {
        string memory prev = _loanData[loanId].uri;
        _loanData[loanId].uri = newUri;
        emit ServicerUriUpdated(loanId, prev, newUri);
    }

    function loanInfo(uint256 loanId) external view returns (LoanMetadata memory metadata, address owner_) {
        metadata = _loanData[loanId];
        owner_ = ownerOf(loanId);
    }
}
