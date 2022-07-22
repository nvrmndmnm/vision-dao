// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
@title ERC-20 token
@author Seydou Obedias
*/
contract Token is ERC20, Ownable {
    uint256 public governedValue;

    /**
    Constructor
    @param name Token name
    @param symbol Token symbol
    */
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        governedValue = 0;
    }

    /**
    Mints new tokens
    @param to Recipient address
    @param amount Amount of tokens to mint
    @notice Can only be called by the contract owner
    */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
    Burns tokens
    @param owner Owner address address
    @param amount Amount of tokens to burn
    @notice Can only be called by the contract owner
    */
    function burn(address owner, uint256 amount) external onlyOwner {
        _burn(owner, amount);
    }

    /**
    A demo function that is callable by the external governor contract
    @notice Can only be called by the contract owner
    */
    function governedDemoFunction() external onlyOwner {
        governedValue += 1;
    }
}