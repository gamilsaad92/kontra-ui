// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IWhitelistRegistry {
    function isWhitelisted(address account) external view returns (bool);
}

/// @title PoolToken
/// @notice ERC-20 token representing a pooled credit instrument with whitelist enforcement.
contract PoolToken is ERC20, Ownable {
    string public poolId;
    address public whitelistRegistry;
    bool public active;

    error PoolInactive();
    error AddressNotWhitelisted(address account);

    constructor(
        string memory _poolId,
        string memory name_,
        string memory symbol_,
        uint256 initialSupply,
        address admin,
        address registry
    ) ERC20(name_, symbol_) {
        require(bytes(_poolId).length != 0, "poolId required");
        require(admin != address(0), "admin required");
        require(registry != address(0), "registry required");
        poolId = _poolId;
        whitelistRegistry = registry;
        active = true;
        _transferOwnership(admin);
        _mint(admin, initialSupply);
    }

    function setActive(bool isActive) external onlyOwner {
        active = isActive;
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal view override {
        super._beforeTokenTransfer(from, to, amount);
        if (!active) revert PoolInactive();
        if (from != address(0) && !_isAllowed(from)) revert AddressNotWhitelisted(from);
        if (to != address(0) && !_isAllowed(to)) revert AddressNotWhitelisted(to);
    }

    function _isAllowed(address account) private view returns (bool) {
        return IWhitelistRegistry(whitelistRegistry).isWhitelisted(account);
    }
}
