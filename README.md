# RealmGatekeeper Minecraft Mod

RealmGatekeeper is a Minecraft Bedrock behavior pack mod for controlling dimension access, administrator-defined structure zones, and player-versus-player combat with owner and admin tags.

## Install

1. Import the behavior pack into Minecraft, or copy the pack folder into the world’s `behavior_packs` directory.
2. Open the world settings and activate RealmGatekeeper under Behavior Packs.
3. Enable Cheats so administrators can use `/tag` and `/scriptevent`.
4. Add the owner or admin tag to trusted players:

```mcfunction
/tag @s add acg_owner
/tag PlayerName add acg_admin
```

Only players with the `acg_owner` or `acg_admin` tag can change or list access and PvP rules.

## Use

Run management commands with the `acg:manage` script event:

```mcfunction
/scriptevent acg:manage help
/scriptevent acg:manage list
```

Set access and PvP rules for a dimension:

```mcfunction
/scriptevent acg:manage dimension nether closed nopvp
/scriptevent acg:manage dimension overworld open pvp
/scriptevent acg:manage dimension end open nopvp
```

Supported dimension names are `overworld`, `nether`, `end`, and their Minecraft IDs.

Create a cuboid structure zone using two opposite corners:

```mcfunction
/scriptevent acg:manage zone add temple overworld 100 50 100 140 90 140 closed nopvp
/scriptevent acg:manage zone add arena overworld 200 60 200 240 90 240 open pvp
```

The complete zone command is:

```text
/scriptevent acg:manage zone add <name> <dimension> <x1> <y1> <z1> <x2> <y2> <z2> <open|closed> <pvp|nopvp>
```

Remove a zone with:

```mcfunction
/scriptevent acg:manage zone remove temple
```

List all dimension and zone rules with:

```mcfunction
/scriptevent acg:manage list
```

Dimension rules apply across the whole dimension. A matching zone overrides both the dimension access and PvP settings. If zones overlap, the most recently added matching zone takes precedence. Rules are saved in world dynamic properties.

When a player enters a closed dimension or zone, RealmGatekeeper sends them to their last recorded open location. If no safe location has been recorded, the player is sent to the Overworld at coordinates 0, 100, 0. Access checks run every 10 ticks, so enforcement can take up to half a second.

PvP is canceled for player melee attacks when the victim’s effective zone or dimension rule has PvP disabled. Zones are administrator-defined cuboid areas and do not automatically detect generated Minecraft structures.

---

More Minecraft mod projects by EnderDevelopment: https://github.com/EnderDevelopment

Project page: https://dash.enderdevelopment.com/community/01ac8258-c47d-4fdc-a98c-dd5f90f0a5f9?utm_source=github&utm_medium=readme&utm_campaign=auto_publish&utm_content=01ac8258-c47d-4fdc-a98c-dd5f90f0a5f9
