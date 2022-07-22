import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract, ContractFactory } from "ethers";
import { ethers } from "hardhat";

const { expect } = require("chai");

let jsonAbi = [{
    "name": "governedDemoFunction",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
}
];
const iface = new ethers.utils.Interface(jsonAbi);
const calldata = iface.encodeFunctionData('governedDemoFunction');

describe("Governance contract", () => {
    let Token: ContractFactory;
    let Governance: ContractFactory;
    let token: Contract;
    let governance: Contract;
    let owner: SignerWithAddress;
    let addr1: SignerWithAddress;
    let addr2: SignerWithAddress;
    let chairman: SignerWithAddress;

    beforeEach(async () => {
        Token = await ethers.getContractFactory("Token");
        Governance = await ethers.getContractFactory("Governance");
        [owner, addr1, addr2, chairman] = await ethers.getSigners();

        token = await Token.deploy("Vision DAO Token", "VDT");
        governance = await Governance.deploy(chairman.address, token.address, 7000, 259200);
        token.mint(owner.address, 10000);
        token.transfer(addr1.address, 1000);
        token.connect(addr1).approve(governance.address, 1000);
        token.transfer(addr2.address, 9000);
        token.connect(addr2).approve(governance.address, 9000);
        token.transferOwnership(governance.address);
    });

    describe("Deployment", () => {
        it("Should have correct initial values", async () => {
            expect(await governance.governorAddress()).to.equal(chairman.address);
            expect(await governance.voteToken()).to.equal(token.address);
            expect(await governance.minimumQuorum()).to.equal(7000);
            expect(await governance.totalDeposits()).to.equal(0);
            expect(await governance.votingPeriod()).to.equal(259200);
        });
    });

    describe("Deposits", () => {
        it("Should add tokens to deposit", async () => {
            await governance.connect(addr1).deposit(1000);
            expect(await governance.deposits(addr1.address)).to.equal(1000);
            expect(await token.balanceOf(addr1.address)).to.equal(0);
        });
        it("Should withdraw tokens from deposit", async () => {
            await governance.connect(addr1).deposit(1000);
            await governance.connect(addr1).withdraw(600);
            expect(await governance.deposits(addr1.address)).to.equal(400);
            expect(await token.balanceOf(addr1.address)).to.equal(600);
        });
        it("Should withdraw tokens after finishing voting", async () => {
            await governance.connect(chairman).propose(calldata, token.address, "Unique proposal");
            await governance.connect(addr1).deposit(1000);
            await governance.connect(addr1).castVote(0, 1);
            await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]);
            await governance.connect(addr1).withdraw(600);
            expect(await governance.deposits(addr1.address)).to.equal(400);
            expect(await token.balanceOf(addr1.address)).to.equal(600);
        });
        it("Should revert frozen tokens withdrawal", async () => {
            await governance.connect(chairman).propose(calldata, token.address, "Unique proposal");
            await governance.connect(addr1).deposit(1000);
            await governance.connect(addr1).castVote(0, 1);
            await expect(governance.connect(addr1).withdraw(600))
                .to.be.revertedWith("Tokens are frozen by active vote");
            expect(await governance.deposits(addr1.address)).to.equal(1000);
            expect(await token.balanceOf(addr1.address)).to.equal(0);
        });
    });

    describe("Proposals", () => {
        it("Should add new proposals", async () => {
            await governance.connect(chairman).propose(calldata, token.address, "Unique proposal");
        });
        it("Should revert adding new proposals from non-chairman", async () => {
            await expect(governance.connect(addr1).propose(calldata, token.address, "Unique proposal"))
                .to.be.revertedWith("Only chairman can add new proposals");
        });
        it("Should finish losing proposals", async () => {
            await governance.connect(chairman).propose(calldata, token.address, "Unique proposal");
            await governance.connect(addr1).deposit(1000);
            await governance.connect(addr1).castVote(0, 1);
            await governance.connect(addr2).deposit(7000);
            await governance.connect(addr2).castVote(0, 2);
            await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]);
            await governance.connect(addr1).execute(0);
            expect(await token.governedValue()).to.be.equal(0);
        });
        it("Should finish winning proposals", async () => {
            await governance.connect(chairman).propose(calldata, token.address, "Unique proposal");
            await governance.connect(addr1).deposit(1000);
            await governance.connect(addr1).castVote(0, 1);
            await governance.connect(addr2).deposit(7000);
            await governance.connect(addr2).castVote(0, 1);
            await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]);
            await governance.connect(addr1).execute(0);
            expect(await token.governedValue()).to.be.equal(1);
        });
        it("Should revert finishing active proposals", async () => {
            await governance.connect(chairman).propose(calldata, token.address, "Unique proposal");
            await governance.connect(addr1).deposit(1000);
            await governance.connect(addr1).castVote(0, 1);
            await expect(governance.connect(addr1).execute(0))
                .to.be.revertedWith("Proposal still in progress");
            expect(await token.governedValue()).to.equal(0);
        });
        it("Should revert finishing unsuccessful proposals", async () => {
            await governance.connect(chairman).propose(calldata, token.address, "Unique proposal");
            await governance.connect(addr1).deposit(1000);
            await governance.connect(addr1).castVote(0, 3);
            await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]);
            await expect(governance.connect(addr1).execute(0))
                .to.be.revertedWith("Minimal quorum wasn't reached, proposal failed");
            expect(await token.governedValue()).to.equal(0);
        });
        it("Should revert finishing with wrong signature", async () => {
            await governance.connect(chairman).propose('0x07824c06', token.address, "Unique proposal");
            await governance.connect(addr1).deposit(1000);
            await governance.connect(addr1).castVote(0, 1);
            await governance.connect(addr2).deposit(7000);
            await governance.connect(addr2).castVote(0, 1);
            await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]);
            await expect(governance.connect(addr1).execute(0)).to.be.revertedWith("Function call failed");
            expect(await token.governedValue()).to.equal(0);
        });
    });

    describe("Governance", () => {
        it("Should vote", async () => {
            await governance.connect(chairman).propose(calldata, token.address, "Unique proposal");
            await governance.connect(chairman).propose(calldata, token.address, "Second unique proposal");
            await governance.connect(addr1).deposit(1000);
            await governance.connect(addr1).castVote(0, 3);
            await governance.connect(addr1).castVote(1, 2);
            await governance.connect(addr2).deposit(7000);
            await governance.connect(addr2).castVote(0, 1);
            await governance.connect(addr2).castVote(1, 0);
            expect(await governance.votes(0, addr1.address)).to.equal(3);
            expect(await governance.votes(1, addr1.address)).to.equal(2);
            expect(await governance.votes(0, addr2.address)).to.equal(1);
            expect(await governance.votes(1, addr2.address)).to.equal(0);
        });
        it("Should revert if no tokens deposited", async () => {
            await expect(governance.connect(addr1).castVote(1, 1))
                .to.be.revertedWith("Deposit some tokens to vote");
        });
        it("Should revert if no such proposal", async () => {
            await governance.connect(addr1).deposit(1000);
            await expect(governance.connect(addr1).castVote(1, 1))
                .to.be.revertedWith("Proposal with such id does not exist");
        });
        it("Should revert if proposal has expired", async () => {
            await governance.connect(addr1).deposit(1000);
            await governance.connect(chairman).propose(calldata, token.address, "Unique proposal");
            await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]);
            await expect(governance.connect(addr1).castVote(0, 1))
                .to.be.revertedWith("This proposal has expired");
        });
        it("Should revert if already voted", async () => {
            await governance.connect(addr1).deposit(1000);
            await governance.connect(chairman).propose(calldata, token.address, "Unique proposal");
            await governance.connect(addr1).castVote(0, 1);
            await expect(governance.connect(addr1).castVote(0, 2))
                .to.be.revertedWith("You have already voted on this proposal");
        });
    });
});