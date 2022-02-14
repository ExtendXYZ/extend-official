use legal_chess::pieces::{piece, position, relative_position};
use legal_chess::{attack, attack::AttackedBoard, game, chessmove, color};

// This file re-implements most of the private functions from legal_chess::game.
// This is horrible.
// Why do it?
// Because otherwise we run out of instructions while re-computing king attackers
// (which we need to know whether 0 legal moves is checkmate or stalemate).
// We need to do moves and attackers in one pass to stay under budget,
// hence moves_and_king_attacked.
// Sorry about that.

pub fn moves_and_king_attacked(g: &game::Game) -> (Vec<chessmove::ChessMove>, bool) {
    let other_side = match g.side_to_move() {
        color::Color::WHITE => color::Color::BLACK,
        color::Color::BLACK => color::Color::WHITE,
    };
    let attacked_board =
        attack::get_attacked_squares(g.board(), other_side, g.current_king_position());
    let king_position = g.current_king_position();
    let king_square_attackers =
        &attacked_board[king_position.0 as usize - 1][king_position.1 as usize - 1];

    let king = match g.board().get_square(king_position) {
        Some(king) => king,
        _ => panic!("No King found at king position"),
    };

    if king_square_attackers.len() > 1 {
        (king_moves(g, king, &attacked_board), !king_square_attackers.is_empty())
    } else {
        let mut moves: Vec<chessmove::ChessMove> = vec![];
        for piece in g.board().pieces_of_color_except_king(*g.side_to_move()) {
            moves.append(&mut (piece.moves(&g.board(), king_position, &g.en_passant())));
        }

        if king_square_attackers.is_empty() {
            moves.append(&mut king_moves(g, king, &attacked_board));
            (moves, !king_square_attackers.is_empty())
        } else {
            let attacker = king_square_attackers[0];
            if attacker.piece() == piece::PieceEnum::KNIGHT {
                moves = moves
                    .into_iter()
                    .filter(|mv| {
                        (mv.to).0 == attacker.position().0 && (mv.to).1 == attacker.position().1
                    })
                    .collect::<Vec<_>>();
                moves.append(&mut king_moves(g, king, &attacked_board));
                (moves, !king_square_attackers.is_empty())
            } else if attacker.piece() == piece::PieceEnum::PAWN {
                moves = moves
                    .into_iter()
                    .filter(|mv| {
                        if let Some(en_passant) = g.en_passant() {
                            match g
                                .board()
                                .get_square(position::Position((mv.from).0, (mv.from).1))
                            {
                                None => panic!(),
                                Some(piece) => {
                                    if piece.piece() == piece::PieceEnum::PAWN {
                                        ((mv.to).0 == en_passant.0 && (mv.to).1 == en_passant.1)
                                            || ((mv.to).0 == attacker.position().0
                                            && (mv.to).1 == attacker.position().1)
                                    } else {
                                        (mv.to).0 == attacker.position().0
                                            && (mv.to).1 == attacker.position().1
                                    }
                                }
                            }
                        } else {
                            (mv.to).0 == attacker.position().0
                                && (mv.to).1 == attacker.position().1
                        }
                    })
                    .collect::<Vec<_>>();
                moves.append(&mut king_moves(g, king, &attacked_board));
                (moves, !king_square_attackers.is_empty())
            } else {
                let (mover, _) = match relative_position::get_line_to_other_piece(
                    king.position(),
                    attacker.position(),
                ) {
                    None => panic!(),
                    Some(v) => v,
                };
                let mut allowed_positions = vec![];

                let mut new_file = king.position().0 as i8;
                let mut new_rank = king.position().1 as i8;

                loop {
                    new_file += mover.0;
                    new_rank += mover.1;

                    let new_position = position::Position(new_file as u8, new_rank as u8);

                    allowed_positions.push(new_position);
                    if g.board().get_square(new_position).is_some() {
                        break;
                    }
                }

                moves = moves
                    .into_iter()
                    .filter(|mv| {
                        allowed_positions.contains(&position::Position((mv.to).0, (mv.to).1))
                    })
                    .collect::<Vec<_>>();

                moves.append(&mut king_moves(g, king, &attacked_board));
                (moves, !king_square_attackers.is_empty())
            }
        }
    }
}

fn king_moves(
    g: &game::Game,
    king: &Box<dyn piece::Piece>,
    attacked_board: &AttackedBoard,
) -> Vec<chessmove::ChessMove> {
    if king.piece() != piece::PieceEnum::KING {
        panic!("Given piece is not a king");
    }

    let moves = king.moves(g.board(), *king.position(), &None);

    let mut moves = moves
        .into_iter()
        .filter(|mv| square_safe(&position::Position((mv.to).0, (mv.to).1), attacked_board))
        .collect::<Vec<_>>();

    if square_under_attack(king.position(), &attacked_board) {
        return moves;
    }

    let castling_rights = match g.side_to_move() {
        color::Color::BLACK => g.castling_rights_black(),
        color::Color::WHITE => g.castling_rights_white(),
    };

    if castling_rights.0 && can_castle_kingside(g, king, attacked_board) {
        moves.push(chessmove::ChessMove {
            from: (king.position().0, king.position().1),
            to: (king.position().0 + 2, king.position().1),
            promotion: None,
        });
    }

    if castling_rights.1 && can_castle_queenside(g, king, attacked_board) {
        moves.push(chessmove::ChessMove {
            from: (king.position().0, king.position().1),
            to: (king.position().0 - 2, king.position().1),
            promotion: None,
        });
    }

    moves
}

fn is_empty_square(g: &game::Game, position: &position::Position) -> bool {
    g.board().get_square(*position).is_none()
}

fn can_castle_kingside(
    g: &game::Game,
    king: &Box<dyn piece::Piece>,
    attacked_board: &AttackedBoard,
) -> bool {
    let one_right_of_king = position::Position(king.position().0 + 1, king.position().1);
    let two_right_of_king = position::Position(king.position().0 + 2, king.position().1);

    is_empty_square(g, &one_right_of_king)
        && is_empty_square(g, &two_right_of_king)
        && square_safe(&one_right_of_king, attacked_board)
        && square_safe(&two_right_of_king, attacked_board)
}

fn can_castle_queenside(
    g: &game::Game,
    king: &Box<dyn piece::Piece>,
    attacked_board: &AttackedBoard,
) -> bool {
    let one_left_of_king = position::Position(king.position().0 - 1, king.position().1);
    let two_left_of_king = position::Position(king.position().0 - 2, king.position().1);
    let three_left_king = position::Position(king.position().0 - 3, king.position().1);

    is_empty_square(g, &one_left_of_king)
        && is_empty_square(g, &two_left_of_king)
        && is_empty_square(g, &three_left_king)
        && square_safe(&one_left_of_king, attacked_board)
        && square_safe(&two_left_of_king, attacked_board)
}

fn square_safe(
    position: &position::Position,
    attacked_board: &[std::vec::Vec<std::vec::Vec<&std::boxed::Box<dyn piece::Piece>>>],
) -> bool {
    attacked_board[position.0 as usize - 1][position.1 as usize - 1].is_empty()
}

fn square_under_attack(
    position: &position::Position,
    attacked_board: &[std::vec::Vec<std::vec::Vec<&std::boxed::Box<dyn piece::Piece>>>],
) -> bool {
    !square_safe(position, attacked_board)
}