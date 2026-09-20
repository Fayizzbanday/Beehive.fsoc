// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BeeHiveRegistry — immutable, authorized honey record fingerprints.
/// @notice Certification proves record integrity, not the truth of producer claims.
contract BeeHiveRegistry {
    struct Record { bytes32 recordHash; uint64 timestamp; address registrant; }
    address public immutable owner;
    mapping(address => bool) public registrars;
    mapping(bytes32 => Record) private records;
    mapping(bytes32 => bool) private registeredHashes;
    event RecordRegistered(bytes32 indexed recordHash, string publicId, address indexed registrant, uint64 timestamp);
    event RegistrarUpdated(address indexed registrar, bool authorized);
    error Unauthorized();
    error DuplicateRecord();
    error InvalidRecord();
    constructor() { owner = msg.sender; registrars[msg.sender] = true; }
    function setRegistrar(address registrar, bool authorized) external {
        if (msg.sender != owner) revert Unauthorized();
        if (registrar == address(0)) revert InvalidRecord();
        registrars[registrar] = authorized;
        emit RegistrarUpdated(registrar, authorized);
    }
    function registerRecord(bytes32 recordHash, string calldata publicId) external {
        if (!registrars[msg.sender]) revert Unauthorized();
        if (recordHash == bytes32(0) || bytes(publicId).length < 6 || bytes(publicId).length > 64) revert InvalidRecord();
        bytes32 publicIdHash = keccak256(bytes(publicId));
        if (records[publicIdHash].timestamp != 0 || registeredHashes[recordHash]) revert DuplicateRecord();
        uint64 timestamp = uint64(block.timestamp);
        records[publicIdHash] = Record(recordHash, timestamp, msg.sender);
        registeredHashes[recordHash] = true;
        emit RecordRegistered(recordHash, publicId, msg.sender, timestamp);
    }
    function verifyRecord(bytes32 recordHash) external view returns (bool) { return registeredHashes[recordHash]; }
    function getRecord(string calldata publicId) external view returns (bytes32 recordHash, uint64 timestamp, address registrant) {
        Record memory record = records[keccak256(bytes(publicId))];
        return (record.recordHash, record.timestamp, record.registrant);
    }
}
