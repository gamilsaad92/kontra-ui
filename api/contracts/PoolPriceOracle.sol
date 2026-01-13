// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

/// @title PoolPriceOracle
/// @notice Maps pool tokens to Chainlink price feeds and exposes latest price data.
contract PoolPriceOracle is Ownable {
    mapping(address => address) private _poolFeeds;
    address public operator;

    event PoolFeedUpdated(address indexed pool, address indexed feed);
    event OperatorUpdated(address indexed operator);

    constructor(address owner_) Ownable(owner_) {}

    function setOperator(address operator_) external onlyOwner {
        require(operator_ != address(0), "operator required");
        operator = operator_;
        emit OperatorUpdated(operator_);
    }

    function setPoolFeed(address pool, address feed) external {
        require(msg.sender == owner() || msg.sender == operator, "not authorized");
        require(pool != address(0), "pool required");
        require(feed != address(0), "feed required");
        _poolFeeds[pool] = feed;
        emit PoolFeedUpdated(pool, feed);
    }

    function poolFeed(address pool) external view returns (address) {
        return _poolFeeds[pool];
    }

    function latestPrice(address pool) external view returns (int256 price, uint8 decimals, uint256 updatedAt) {
        address feed = _poolFeeds[pool];
        require(feed != address(0), "feed not set");
        AggregatorV3Interface aggregator = AggregatorV3Interface(feed);
        (, int256 answer, , uint256 updatedAtValue, ) = aggregator.latestRoundData();
        return (answer, aggregator.decimals(), updatedAtValue);
    }

    function feedDescription(address pool) external view returns (string memory) {
        address feed = _poolFeeds[pool];
        require(feed != address(0), "feed not set");
        return AggregatorV3Interface(feed).description();
    }
}
