// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract SkillBadge is ERC721, Ownable {
    using Counters for Counters.Counter;
    using Strings for uint256;

    Counters.Counter private _tokenIds;
    uint256 private immutable MAX_BADGES;

    event BadgeAwarded(uint256 indexed tokenId, address indexed recipient, string skillName, uint256 issuedDate);
    event BadgeMetadataUpdated(uint256 indexed tokenId, string newEvidenceURI);
    event BadgeEndorsed(uint256 indexed tokenId, address indexed endorser);
    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);

    struct Badge {
        string skillName;
        uint256 issuedDate;
        string evidenceURI;
    }

    mapping(uint256 => Badge) private _badges;
    mapping(uint256 => address[]) private _endorsers;
    mapping(uint256 => mapping(address => bool)) private _hasEndorsed;
    mapping(address => bool) private _issuers;

    constructor(uint256 maxBadges_) ERC721("SkillBadge", "SB") {
        MAX_BADGES = (maxBadges_ == 0) ? 10000 : maxBadges_;
    }

    /**
     * @dev Add a new issuer. Only owner can call.
     */
    function addIssuer(address issuer) public onlyOwner {
        require(issuer != address(0), "Issuer cannot be zero address");
        require(!_issuers[issuer], "Already an issuer");
        _issuers[issuer] = true;
        emit IssuerAdded(issuer);
    }

    /**
     * @dev Remove an issuer. Only owner can call.
     */
    function removeIssuer(address issuer) public onlyOwner {
        require(_issuers[issuer], "Not an issuer");
        _issuers[issuer] = false;
        emit IssuerRemoved(issuer);
    }

    /**
     * @dev Returns true if the address is an authorized issuer.
     */
    function isIssuer(address account) public view returns (bool) {
        return _issuers[account];
    }

    /**
     * @dev Mint a badge to a recipient. Only owner or issuer can call.
     * Unique: Issuers cannot mint badges to themselves or to other issuers (only to non-issuer addresses).
     */
    function awardBadge(address recipient, string memory skillName, string memory evidenceURI) public returns (uint256) {
        require(recipient != address(0), "Recipient cannot be zero address");
        require(bytes(skillName).length > 0, "Skill name cannot be empty");
        require(bytes(evidenceURI).length > 0, "Evidence URI cannot be empty");

        bool senderIsOwner = (msg.sender == owner());
        bool senderIsIssuer = _issuers[msg.sender];
        require(senderIsOwner || senderIsIssuer, "Not authorized to mint");
        // Unique: Issuers cannot mint to themselves or to other issuers
        if (senderIsIssuer && !senderIsOwner) {
            require(!_issuers[recipient] && recipient != msg.sender, "Issuers can only mint to non-issuer addresses");
        }

        uint256 newItemId = _tokenIds.current();
        require(newItemId < MAX_BADGES, "Maximum number of badges reached");

        _badges[newItemId] = Badge({
            skillName: skillName,
            issuedDate: block.timestamp,
            evidenceURI: evidenceURI
        });

        _safeMint(recipient, newItemId);
        emit BadgeAwarded(newItemId, recipient, skillName, block.timestamp);
        _tokenIds.increment();
        return newItemId;
    }

    function updateBadgeEvidence(uint256 tokenId, string memory newEvidenceURI) public onlyOwner {
        require(_exists(tokenId), "Token does not exist");
        _badges[tokenId].evidenceURI = newEvidenceURI;
        emit BadgeMetadataUpdated(tokenId, newEvidenceURI);
    }

    function getBadgeInfo(uint256 tokenId) public view returns (string memory skillName, uint256 issuedDate, string memory evidenceURI) {
        require(_exists(tokenId), "Token does not exist");
        Badge storage badge = _badges[tokenId];
        return (badge.skillName, badge.issuedDate, badge.evidenceURI);
    }

    function _baseURI() internal pure override returns (string memory) {
        return "https://api.your-domain.com/badges/";
    }

    /**
     * @dev Endorse a badge (tokenId). A user can endorse a badge only once.
     * Emits a BadgeEndorsed event.
     */
    function endorseBadge(uint256 tokenId) public {
        require(_exists(tokenId), "Token does not exist");
        require(!_hasEndorsed[tokenId][msg.sender], "Already endorsed this badge");
        _endorsers[tokenId].push(msg.sender);
        _hasEndorsed[tokenId][msg.sender] = true;
        emit BadgeEndorsed(tokenId, msg.sender);
    }

    /**
     * @dev Returns the list of endorsers for a badge (tokenId).
     */
    function getEndorsers(uint256 tokenId) public view returns (address[] memory) {
        require(_exists(tokenId), "Token does not exist");
        return _endorsers[tokenId];
    }
}