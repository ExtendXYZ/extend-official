

## RULES OF THE GAME

### Lifecycle
- A board is initialized through an InitBoard ix on an account with sufficient space.
- A game can be started by the board creator through a StartGame ix.
- An initialized board starts in the "Inactive" state and cycles through three states:
    - Registering
    - Active
    - Inactive
- An inactive game can be (re-) initialized by StartGame, setting it to Registering state.

### Registering
- Any Space owner can be assigned a side for the currently registering game with a Register ix.
- Spaces cannot be assigned to a side with a registered Pubkey.

### Voting
- The first Vote ix past the registration deadline shifts the game to Active.
- Move votes must be made within move_interval seconds after the previous deadline.
- Spaces assigned to the side to play can vote for any legal move.
- A running tally of votes is maintained.
- A vote for Move::resign() counts as a vote for resignation.
- The game updates when:
    - PK player has voted
    - Move_deadline has passed and another Vote ix is received
- An update works as follows:
    - If any votes have been cast, the most popular move is applied (first to submit breaks ties)
    - Votes are reset
    - Termination conditions are checked
- The game ends when any of the following occur:
    - Checkmate
    - Stalemate
    - The winning move is Move::resign()
    - Deadline elapses with no valid moves

### Inactive
- An inactive board preserves the final game state along with a result.
- A new game, replacing the old one, can be initialized with a StartGame ix.
- Assigned spaces and votes are reset when the game is re-initialized.
