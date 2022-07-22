import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import 'dotenv/config';

const GOVERNANCE_ADDRESS = `${process.env.GOVERNANCE_ADDRESS}`;

task("vote", "Vote on selected proposal")
    .addParam("sender", "Voter address")
    .addParam("proposal", "Active proposal ID")
    .addParam("decision", "1 for yes, 2 for no, 3 to abstain")
    .setAction(async (args, hre) => {
        const governance = await hre.ethers.getContractAt("Governance", GOVERNANCE_ADDRESS);
        const signer = await hre.ethers.getSigner(args.sender);
        await governance.connect(signer).vote(args.proposal, args.decision);
        console.log(`Voted on proposal ${args.proposal}.`);
    });

task("propose", "Create a new proposal")
    .addParam("sender", "Voter address")
    .addParam("signature", "Function signature")
    .addParam("recipient", "Recipient contract address")
    .addParam("description", "Proposal description")
    .setAction(async (args, hre) => {
        const governance = await hre.ethers.getContractAt("Governance", GOVERNANCE_ADDRESS);
        const signer = await hre.ethers.getSigner(args.sender);
        await governance.connect(signer).addProposal(args.signature, args.recipient, args.description);
        console.log(`Added new proposal with description "${args.description}".`);
    });

task("execute", "Execute selected proposal")
    .addParam("sender", "Voter address")
    .addParam("proposal", "Active proposal ID")
    .setAction(async (args, hre) => {
        const governance = await hre.ethers.getContractAt("Governance", GOVERNANCE_ADDRESS);
        const signer = await hre.ethers.getSigner(args.voter);
        await governance.connect(signer).finishProposal(args.proposal);
        console.log(`Finished proposal with ID ${args.proposal}.`);
    });

task("deposit", "Deposit tokens to contract")
    .addParam("sender", "Voter address")
    .addParam("amount", "Amount of tokens to deposit")
    .setAction(async (args, hre) => {
        const governance = await hre.ethers.getContractAt("Governance", GOVERNANCE_ADDRESS);
        const signer = await hre.ethers.getSigner(args.sender);
        await governance.connect(signer).deposit(args.amount);
        console.log(`Added ${args.amount} tokens to deposit.`);
    });