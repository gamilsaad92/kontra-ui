// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PoolToken.sol";
import "./WhitelistRegistry.sol";

/// @title PoolFactory
/// @notice Deploys PoolToken instances wired to a shared whitelist registry.
contract PoolFactory {
    address public whitelistRegistry;
    address public admin;

    event PoolCreated(address indexed poolAddress, string poolId, string name, string symbol, address admin);

    constructor(address registry, address owner) {
        require(registry != address(0), "registry required");
        require(owner != address(0), "owner required");
        whitelistRegistry = registry;
        admin = owner;
    }

    function createPool(
        string calldata poolId,
        string calldata name,
        string calldata symbol,
        uint256 initialSupply,
        address poolAdmin
    ) external returns (address) {
        require(msg.sender == admin, "only admin");
        PoolToken token = new PoolToken(poolId, name, symbol, initialSupply, poolAdmin, whitelistRegistry);
        emit PoolCreated(address(token), poolId, name, symbol, poolAdmin);
        return address(token);
    }
}
