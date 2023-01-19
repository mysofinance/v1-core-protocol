const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Decoding test", function () {
  const ABI = [
    {
      "inputs": [
        {
          "internalType": "uint24",
          "name": "_loanTenor",
          "type": "uint24"
        },
        {
          "internalType": "uint128",
          "name": "_maxLoanPerColl",
          "type": "uint128"
        },
        {
          "internalType": "uint256",
          "name": "_r1",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_r2",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_liquidityBnd1",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_liquidityBnd2",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_minLoan",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_baseAggrBucketSize",
          "type": "uint256"
        },
        {
          "internalType": "uint128",
          "name": "_creatorFee",
          "type": "uint128"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "inputs": [],
      "name": "AlreadyRepaid",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "BeforeEarliestRemove",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "CannotClaimWithUnsettledLoan",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "CannotRepayAfterExpiry",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "CannotRepayInSameBlock",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "ErroneousLoanTerms",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "IdenticalLoanAndCollCcy",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InsufficientLiquidity",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "Invalid",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidAddAmount",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidApprovalAddress",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidBaseAggrSize",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidFee",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidLiquidityBnds",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidLoanIdx",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidLoanTenor",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidMaxLoanPerColl",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidMinLiquidity",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidNewSharePointer",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidRateParams",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidRecipient",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidRemove",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidRollOver",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidSendAmount",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidSubAggregation",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidZeroAddress",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "LoanBelowLimit",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "LoanIdxsWithChangingShares",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "LoanTooSmall",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "MustBeLp",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "NonAscendingLoanIdxs",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "NothingToClaim",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "PastDeadline",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "RepaymentAboveLimit",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "UnapprovedSender",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "UnentitledFromLoanIdx",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "ZeroShareClaim",
      "type": "error"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "lp",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "newLpShares",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "totalLiquidity",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "totalLpShares",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "earliestRemove",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "loanIdx",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "referralCode",
          "type": "uint256"
        }
      ],
      "name": "AddLiquidity",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "address",
          "name": "ownerOrBeneficiary",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "sender",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "_packedApprovals",
          "type": "uint256"
        }
      ],
      "name": "ApprovalUpdate",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "borrower",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "loanIdx",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "collateral",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "loanAmount",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "repaymentAmount",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "totalLpShares",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "expiry",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "referralCode",
          "type": "uint256"
        }
      ],
      "name": "Borrow",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "lp",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256[]",
          "name": "loanIdxs",
          "type": "uint256[]"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "repayments",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "collateral",
          "type": "uint256"
        }
      ],
      "name": "Claim",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "lp",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "fromLoanIdx",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "toLoanIdx",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "repayments",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "collateral",
          "type": "uint256"
        }
      ],
      "name": "ClaimFromAggregated",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "lpAddr",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "bool",
          "name": "isApproved",
          "type": "bool"
        }
      ],
      "name": "LpWhitelistUpdate",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "address",
          "name": "loanCcyToken",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "collCcyToken",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "loanTenor",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "maxLoanPerColl",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "r1",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "r2",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "liquidityBnd1",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "liquidityBnd2",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "minLoan",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "creatorFee",
          "type": "uint256"
        }
      ],
      "name": "NewSubPool",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "lp",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "repayments",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "newLpShares",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "earliestRemove",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "loanIdx",
          "type": "uint256"
        }
      ],
      "name": "Reinvest",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "lp",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "removedLpShares",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "totalLiquidity",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "totalLpShares",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "loanIdx",
          "type": "uint256"
        }
      ],
      "name": "RemoveLiquidity",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "borrower",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "loanIdx",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "repaymentAmountAfterFees",
          "type": "uint256"
        }
      ],
      "name": "Repay",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "maxLoanPerColl",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "creatorFee",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "r1",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "r2",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "liquidityBnd1",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "liquidityBnd2",
          "type": "uint256"
        }
      ],
      "name": "UpdatedTerms",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_onBehalfOf",
          "type": "address"
        },
        {
          "internalType": "uint128",
          "name": "_sendAmount",
          "type": "uint128"
        },
        {
          "internalType": "uint256",
          "name": "_deadline",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_referralCode",
          "type": "uint256"
        }
      ],
      "name": "addLiquidity",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_onBehalf",
          "type": "address"
        },
        {
          "internalType": "uint128",
          "name": "_sendAmount",
          "type": "uint128"
        },
        {
          "internalType": "uint128",
          "name": "_minLoanLimit",
          "type": "uint128"
        },
        {
          "internalType": "uint128",
          "name": "_maxRepayLimit",
          "type": "uint128"
        },
        {
          "internalType": "uint256",
          "name": "_deadline",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_referralCode",
          "type": "uint256"
        }
      ],
      "name": "borrow",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_onBehalfOf",
          "type": "address"
        },
        {
          "internalType": "uint256[]",
          "name": "_loanIdxs",
          "type": "uint256[]"
        },
        {
          "internalType": "bool",
          "name": "_isReinvested",
          "type": "bool"
        },
        {
          "internalType": "uint256",
          "name": "_deadline",
          "type": "uint256"
        }
      ],
      "name": "claim",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "claimCreator",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_onBehalfOf",
          "type": "address"
        },
        {
          "internalType": "uint256[]",
          "name": "_aggIdxs",
          "type": "uint256[]"
        },
        {
          "internalType": "bool",
          "name": "_isReinvested",
          "type": "bool"
        },
        {
          "internalType": "uint256",
          "name": "_deadline",
          "type": "uint256"
        }
      ],
      "name": "claimFromAggregated",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "creatorFee",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_fromLoanIdx",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_toLoanIdx",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_shares",
          "type": "uint256"
        }
      ],
      "name": "getClaimsFromAggregated",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "repayments",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "collateral",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_lpAddr",
          "type": "address"
        }
      ],
      "name": "getLpInfo",
      "outputs": [
        {
          "internalType": "uint32",
          "name": "fromLoanIdx",
          "type": "uint32"
        },
        {
          "internalType": "uint32",
          "name": "earliestRemove",
          "type": "uint32"
        },
        {
          "internalType": "uint32",
          "name": "currSharePtr",
          "type": "uint32"
        },
        {
          "internalType": "uint256[]",
          "name": "sharesOverTime",
          "type": "uint256[]"
        },
        {
          "internalType": "uint256[]",
          "name": "loanIdxsWhereSharesChanged",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getPoolInfo",
      "outputs": [
        {
          "internalType": "address",
          "name": "_loanCcyToken",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "_collCcyToken",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "_maxLoanPerColl",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_minLoan",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_loanTenor",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_totalLiquidity",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_totalLpShares",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_baseAggrBucketSize",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_loanIdx",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getRateParams",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "_liquidityBnd1",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_liquidityBnd2",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_r1",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_r2",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        },
        {
          "internalType": "enum IBasePool_v_1_1.ApprovalTypes",
          "name": "",
          "type": "uint8"
        }
      ],
      "name": "isApproved",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "loanIdxToBorrower",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "loanIdxToLoanInfo",
      "outputs": [
        {
          "internalType": "uint128",
          "name": "repayment",
          "type": "uint128"
        },
        {
          "internalType": "uint128",
          "name": "collateral",
          "type": "uint128"
        },
        {
          "internalType": "uint128",
          "name": "totalLpShares",
          "type": "uint128"
        },
        {
          "internalType": "uint32",
          "name": "expiry",
          "type": "uint32"
        },
        {
          "internalType": "bool",
          "name": "repaid",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint128",
          "name": "_inAmountAfterFees",
          "type": "uint128"
        }
      ],
      "name": "loanTerms",
      "outputs": [
        {
          "internalType": "uint128",
          "name": "loanAmount",
          "type": "uint128"
        },
        {
          "internalType": "uint128",
          "name": "repaymentAmount",
          "type": "uint128"
        },
        {
          "internalType": "uint128",
          "name": "pledgeAmount",
          "type": "uint128"
        },
        {
          "internalType": "uint256",
          "name": "_creatorFee",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_totalLiquidity",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "lpWhitelist",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_newSharePointer",
          "type": "uint256"
        }
      ],
      "name": "overrideSharePointer",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "poolCreator",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "newAddr",
          "type": "address"
        }
      ],
      "name": "proposeNewCreator",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_onBehalfOf",
          "type": "address"
        },
        {
          "internalType": "uint128",
          "name": "numShares",
          "type": "uint128"
        }
      ],
      "name": "removeLiquidity",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_loanIdx",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "_recipient",
          "type": "address"
        },
        {
          "internalType": "uint128",
          "name": "_sendAmount",
          "type": "uint128"
        }
      ],
      "name": "repay",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_approvee",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "_packedApprovals",
          "type": "uint256"
        }
      ],
      "name": "setApprovals",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "newAddr",
          "type": "address"
        }
      ],
      "name": "toggleLpWhitelist",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_maxLoanPerColl",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_creatorFee",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_r1",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_r2",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_liquidityBnd1",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_liquidityBnd2",
          "type": "uint256"
        }
      ],
      "name": "updateTerms",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ]


  it("Decoding data", async function () {
    const BASE = ethers.BigNumber.from("10").pow("18")
    const ONE_RPL = ethers.BigNumber.from("10").pow("18")
    const ONE_USDC = ethers.BigNumber.from("10").pow("6")
    const iface = new ethers.utils.Interface(ABI);
    const txData = "0x8c4b8afc000000000000000000000000000000000000000000000000000000000055730000000000000000000000000000000000000000000000000000038d7ea4c68000000000000000000000000000000000000000000000000000009bbc42ca51888400000000000000000000000000000000000000000000000000846005925ee74c000000000000000000000000000000000000000000000000000000003b9aca0000000000000000000000000000000000000000000000000000000002540be400"
    const decodedData = iface.parseTransaction({ data: txData, value: 0 })
    console.log("decodedData", decodedData)
    const maxLoanPerColl = decodedData.args[0]
    const creatorFee = decodedData.args[1]
    const r1 = decodedData.args[2]
    const r2 = decodedData.args[3]
    const liquidityBnd1 = decodedData.args[4]
    const liquidityBnd2 = decodedData.args[5]
    console.log(`maxLoanPerColl=${Number(maxLoanPerColl.div(ONE_USDC.div(100)))/100} (${maxLoanPerColl})`)
    console.log(`creatorFee=${Number(creatorFee.div(BASE.div(10000)))/100}% (${creatorFee})`)
    console.log(`r1=${Number(r1.div(BASE.div(10000)))/100}% (${r1})`)
    console.log(`r2=${Number(r2.div(BASE.div(10000)))/100}% (${r1})`)
    console.log(`liquidityBnd1=${Number(liquidityBnd1.div(ONE_USDC.div(100)))/100} (${liquidityBnd1})`)
    console.log(`liquidityBnd2=${Number(liquidityBnd2.div(ONE_USDC.div(100)))/100} (${liquidityBnd2})`)
  })
});
