import { ethers } from "hardhat";
import 'dotenv/config';

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    console.log("Account balance:", (await deployer.getBalance()).toString());

    const Token = await ethers.getContractFactory("Token");
    const token = await Token.deploy("Vision DAO Token", "VDT");
    await token.deployed();

    await token.mint(deployer.address, ethers.utils.parseEther("10000"));

    console.log("Token address: ", token.address);

    const Governance = await ethers.getContractFactory("Governance");
    const governance = await Governance.deploy(deployer.address, token.address, 7000, 259200);
    await governance.deployed();

    await token.transferOwnership(governance.address);
    console.log("Governance contract address:", governance.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });