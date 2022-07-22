// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

import "./interfaces/IERC20.sol";

/**
@title A simple governance contract with 3 voting options: agree, disagree or abstain
@author Seydou Obedias
*/
contract Governance {
    address public governorAddress;
    IERC20 public voteToken;
    uint256 public minimumQuorum;
    uint256 public totalDeposits;
    uint256 public votingPeriod;

    enum Decision {
        None,
        Agree,
        Disagree,
        Abstain
    }

    struct Proposal {
        uint256 deadline;
        uint256 agreedWeight;
        uint256 disagreedWeight;
        uint256 abstainedWeight;
        string description;
        bool finishedPositive;
        address recipient;
        bytes signature;
    }

    Proposal[] public proposals;
    mapping(address => uint256) public deposits;
    mapping(uint256 => mapping(address => Decision)) public votes;

    /**
    Emitted when tokens deposited to the contract
    @param from Sender address
    @param amount Amount of deposited tokens
    */
    event Deposited(address from, uint256 amount);

    /**
    Emitted when tokens withdrawn from the contract
    @param to Recipient address
    @param amount Amount of withdrawn tokens
    */
    event Withdrawn(address to, uint256 amount);

    /**
    Emitted when vote is cast
    @param voter Voter address 
    @param proposalId Proposal ID
    @param decision Vote decision
    */
    event VoteCast(address voter, uint256 proposalId, uint8 decision);

    /**
    Emitted when new proposal added
    @param proposalId Proposal ID
    @param deadline Proposal finish time
    @param signature Signature of the function to call
    @param recipient Vote recipient contract
    @param description Proposal description
    */
    event ProposalCreated(
        uint256 proposalId,
        uint256 deadline,
        bytes signature,
        address recipient,
        string description
    );

    /**
    Emitted when proposal is finished
    @param proposalId Proposal ID
    @param deadline Proposal finish time
    @param agreedWeight Number of positive votes
    @param disagreedWeight Number of negative votes
    @param abstainedWeight Number of abstain votes
    @param finishedPositive Proposal finish status
    @param signature Signature of the function to call
    @param recipient Vote recipient contract
    @param description Proposal description
    */
    event ProposalExecuted(
        uint256 proposalId,
        uint256 deadline,
        uint256 agreedWeight,
        uint256 disagreedWeight,
        uint256 abstainedWeight,
        bool finishedPositive,
        bytes signature,
        address recipient,
        string description
    );

    /**
    Constructor
    @param _governorAddress Governor (admin) address
    @param _voteToken Voting token contract
    @param _minimumQuorum Minimal votes number to finish successfully
    @param _votingPeriod Debating period duration in seconds
    */
    constructor(
        address _governorAddress,
        IERC20 _voteToken,
        uint256 _minimumQuorum,
        uint256 _votingPeriod
    ) {
        governorAddress = _governorAddress;
        voteToken = _voteToken;
        minimumQuorum = _minimumQuorum;
        votingPeriod = _votingPeriod;
    }

    /**
    Deposits tokens to voting contract
    @param _amount Amount of tokens to deposit
    */
    function deposit(uint256 _amount) public {
        voteToken.transferFrom(msg.sender, address(this), _amount);
        deposits[msg.sender] += _amount;
        totalDeposits += _amount;
        emit Deposited(msg.sender, _amount);
    }

    /**
    Withdraws tokens from voting contract
    @param _amount Amount of tokens to withdraw
    */
    function withdraw(uint256 _amount) public {
        require(
            checkWithdrawable(msg.sender),
            "Tokens are frozen by active vote"
        );
        voteToken.transfer(msg.sender, _amount);
        deposits[msg.sender] -= _amount;
        totalDeposits -= _amount;
        emit Withdrawn(msg.sender, _amount);
    }

    /**
    Checks if voter is able to withdraw
    @param voter Voter address
    @return withdrawable Check result
    */
    function checkWithdrawable(address voter)
        internal
        view
        returns (bool withdrawable)
    {
        withdrawable = true;
        for (uint256 i; i < proposals.length; i++) {
            if (
                proposals[i].deadline > block.timestamp &&
                votes[i][voter] != Decision.None
            ) {
                withdrawable = false;
            }
        }
    }

    /**
    Casts a vote on proposal
    @param id Proposal ID
    @param decision Vote decision
    */
    function castVote(uint256 id, uint8 decision) public {
        require(deposits[msg.sender] > 0, "Deposit some tokens to vote");
        require(
            proposals.length > 0 && proposals[id].recipient != address(0),
            "Proposal with such id does not exist"
        );
        require(
            proposals[id].deadline > block.timestamp,
            "This proposal has expired"
        );
        require(
            votes[id][msg.sender] == Decision.None,
            "You have already voted on this proposal"
        );
        if (decision == 1) {
            proposals[id].agreedWeight += deposits[msg.sender];
            votes[id][msg.sender] = Decision.Agree;
        } else if (decision == 2) {
            proposals[id].disagreedWeight += deposits[msg.sender];
            votes[id][msg.sender] = Decision.Disagree;
        } else if (decision == 3) {
            proposals[id].abstainedWeight += deposits[msg.sender];
            votes[id][msg.sender] = Decision.Abstain;
        }
        emit VoteCast(msg.sender, id, decision);
    }

    /**
    Adds new proposal to vote on
    @param _signature Signature of the function to call
    @param _recipient Vote recipient contract
    @param _description Proposal description
    */
    function propose(
        bytes calldata _signature,
        address _recipient,
        string memory _description
    ) public {
        require(
            msg.sender == governorAddress,
            "Only chairman can add new proposals"
        );
        proposals.push(
            Proposal({
                deadline: block.timestamp + votingPeriod,
                agreedWeight: 0,
                disagreedWeight: 0,
                abstainedWeight: 0,
                finishedPositive: false,
                signature: _signature,
                recipient: _recipient,
                description: _description
            })
        );
        emit ProposalCreated(
            proposals.length - 1,
            block.timestamp + votingPeriod,
            _signature,
            _recipient,
            _description
        );
    }

    /**
    Finishes active proposal
    @param id Proposal ID
    @notice Can be called by any user
    */
    function execute(uint256 id) public {
        require(
            block.timestamp > proposals[id].deadline,
            "Proposal still in progress"
        );
        require(
            proposals[id].agreedWeight +
                proposals[id].disagreedWeight +
                proposals[id].abstainedWeight >
                minimumQuorum,
            "Minimal quorum wasn't reached, proposal failed"
        );
        if (proposals[id].agreedWeight > proposals[id].disagreedWeight) {
            (bool success, ) = proposals[id].recipient.call{value: 0}(
                proposals[id].signature
            );
            require(success, "Function call failed");
            proposals[id].finishedPositive = true;
        }
        emit ProposalExecuted(
            id,
            proposals[id].deadline,
            proposals[id].agreedWeight,
            proposals[id].disagreedWeight,
            proposals[id].abstainedWeight,
            proposals[id].finishedPositive,
            proposals[id].signature,
            proposals[id].recipient,
            proposals[id].description
        );
    }
}
