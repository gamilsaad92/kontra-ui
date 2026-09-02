// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title WhitelistRegistry
/// @notice Tracks investor eligibility across the platform.
contract WhitelistRegistry {
    struct InvestorStatus {
        bool isWhitelisted;
        string investorType;
        string kycProviderRef;
    }

    mapping(address => InvestorStatus) private _investors;

    event WhitelistUpdated(address indexed account, bool isWhitelisted, string investorType, string kycProviderRef);

    /// @notice Update or insert whitelist status for a wallet.
    function setWhitelist(
        address account,
        bool isWhitelisted,
        string calldata investorType,
        string calldata kycProviderRef
    ) external {
        require(account != address(0), "Invalid address");
        _investors[account] = InvestorStatus({
            isWhitelisted: isWhitelisted,
            investorType: investorType,
            kycProviderRef: kycProviderRef
        });
        emit WhitelistUpdated(account, isWhitelisted, investorType, kycProviderRef);
    }

    /// @notice Fetch the current whitelist status for an account.
    function investorStatus(address account) external view returns (InvestorStatus memory) {
        return _investors[account];
    }

    /// @notice Simple helper to validate whitelist status.
    function isWhitelisted(address account) external view returns (bool) {
        return _investors[account].isWhitelisted;
    }
}
