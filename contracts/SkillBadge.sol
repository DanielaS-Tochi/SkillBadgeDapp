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
    uint256 private constant MAX_BADGES = 10000;

    event BadgeAwarded(uint256 indexed tokenId, address indexed recipient, string skillName, uint256 issuedDate);
    event BadgeMetadataUpdated(uint256 indexed tokenId, string newEvidenceURI);

    struct Badge {
        string skillName;
        uint256 issuedDate;
        string evidenceURI;
    }

    mapping(uint256 => Badge) private _badges;

    constructor() ERC721("SkillBadge", "SB") {}

    function awardBadge(address recipient, string memory skillName, string memory evidenceURI) public onlyOwner returns (uint256) {
        require(recipient != address(0), "Recipient cannot be zero address");
        require(bytes(skillName).length > 0, "Skill name cannot be empty");
        require(bytes(evidenceURI).length > 0, "Evidence URI cannot be empty");

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
}