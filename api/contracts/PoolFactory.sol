// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PoolToken.sol";
import "./PoolPriceOracle.sol";
import "./WhitelistRegistry.sol";

/// @title PoolFactory
/// @notice Deploys PoolToken instances wired to a shared whitelist registry.
contract PoolFactory {
    address public whitelistRegistry;
    address public admin;
   PoolPriceOracle public priceOracle;

    event PoolCreated(address indexed poolAddress, string poolId, string name, string symbol, address admin);
    event PriceOracleUpdated(address indexed oracle);

     constructor(address registry, address owner, address oracle) {
        require(registry != address(0), "registry required");
        require(owner != address(0), "owner required");
        whitelistRegistry = registry;
        admin = owner;
       if (oracle != address(0)) {
            priceOracle = PoolPriceOracle(oracle);
            emit PriceOracleUpdated(oracle);
        }
    }

    function setPriceOracle(address oracle) external {
        require(msg.sender == admin, "only admin");
        require(oracle != address(0), "oracle required");
        priceOracle = PoolPriceOracle(oracle);
        emit PriceOracleUpdated(oracle);
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

    function createPoolWithPriceFeed(
        string calldata poolId,
        string calldata name,
        string calldata symbol,
        uint256 initialSupply,
        address poolAdmin,
        address priceFeed
    ) external returns (address) {
        require(msg.sender == admin, "only admin");
        require(address(priceOracle) != address(0), "oracle required");
        PoolToken token = new PoolToken(poolId, name, symbol, initialSupply, poolAdmin, whitelistRegistry);
        priceOracle.setPoolFeed(address(token), priceFeed);
        emit PoolCreated(address(token), poolId, name, symbol, poolAdmin);
        return address(token);
    }
}
