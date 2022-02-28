use solana_program::{
    account_info::{AccountInfo, next_account_info},
    borsh::try_from_slice_unchecked,
    entrypoint::ProgramResult,
    program_error::ProgramError,
    pubkey::Pubkey,
    clock::Clock,
    msg,
    program::{invoke, invoke_signed},
    system_instruction, system_program,
    sysvar::{rent, Sysvar},
};
use spl_associated_token_account;
use spl_token;

use crate::{
    instruction::GetVouchersArgs,
    processor::processor_utils::{get_voucher_price},
    state::{
        NEIGHBORHOOD_METADATA_SEED,
        VOUCHER_MINT_SEED,
        VOUCHER_PRICE_TOLERANCE,
        NeighborhoodMetadata,
    },
    validation_utils::{assert_keys_equal, assert_is_ata},
    error::CustomError
};

pub fn process(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: &GetVouchersArgs,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();

    let base = next_account_info(account_info_iter)?;
    let neighborhood_metadata = next_account_info(account_info_iter)?;
    let neighborhood_creator = next_account_info(account_info_iter)?;
    let voucher_mint_auth = next_account_info(account_info_iter)?;
    let voucher_mint = next_account_info(account_info_iter)?;
    let source_ata_voucher = next_account_info(account_info_iter)?;
    let user = next_account_info(account_info_iter)?;
    let user_ata_voucher = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let associated_token_program = next_account_info(account_info_iter)?;
    let rent_sysvar_info = next_account_info(account_info_iter)?;

    // check programs
    assert_keys_equal(system_program::id(), *system_program.key)?;
    assert_keys_equal(spl_token::id(), *token_program.key)?;
    assert_keys_equal(spl_associated_token_account::id(), *associated_token_program.key)?;
    assert_keys_equal(rent::id(), *rent_sysvar_info.key)?;
    
    // deserialize and verify neighborhood metadata
    let neighborhood_metadata_data: NeighborhoodMetadata = try_from_slice_unchecked(&neighborhood_metadata.data.borrow())?;
    let seeds_neighborhood_metadata = &[
        &base.key.to_bytes(),
        NEIGHBORHOOD_METADATA_SEED,
        &args.neighborhood_x.to_le_bytes(),
        &args.neighborhood_y.to_le_bytes(),
        &[neighborhood_metadata_data.bump],
    ];
    let key = Pubkey::create_program_address(seeds_neighborhood_metadata, program_id)?;
    assert_keys_equal(key, *neighborhood_metadata.key)?;

    // verify voucher mint
    let seeds_voucher_mint = &[
        &base.key.to_bytes(),
        VOUCHER_MINT_SEED,
        &args.neighborhood_x.to_le_bytes(),
        &args.neighborhood_y.to_le_bytes(),
    ];
    let (key, bump_voucher_mint) = 
        Pubkey::find_program_address(seeds_voucher_mint, program_id);
    assert_keys_equal(key, *voucher_mint.key)?;
    let seeds_voucher_mint = &[
        &base.key.to_bytes(),
        VOUCHER_MINT_SEED,
        &args.neighborhood_x.to_le_bytes(),
        &args.neighborhood_y.to_le_bytes(),
        &[bump_voucher_mint],
    ];

    // check ATAs

    assert_is_ata(source_ata_voucher, voucher_mint_auth.key, voucher_mint.key)?;

    if user_ata_voucher.data_len() == 0{
        invoke(
            &spl_associated_token_account::create_associated_token_account(
                user.key,
                user.key,
                voucher_mint.key,
            ),
            &[
                user.clone(),
                voucher_mint.clone(),
                user_ata_voucher.clone(),
                system_program.clone(),
                token_program.clone(),
                rent_sysvar_info.clone(),
                associated_token_program.clone(),
            ],
        )?;
    }
    assert_is_ata(user_ata_voucher, user.key, voucher_mint.key)?;

    // check neighborhood creator is passed in correctly
    assert_keys_equal(neighborhood_metadata_data.creator, *neighborhood_creator.key)?;

    // other checks
    if args.count > neighborhood_metadata_data.voucher_receive_limit{
        msg!("Error: too many vouchers requested");
        return Err(ProgramError::InvalidInstructionData);
    }
    let fee = get_voucher_price(neighborhood_metadata_data.voucher_price_coefficient as f64 / 1000000000.0, args.count);
    if (args.fee as i64 - fee as i64).abs() as u64 > VOUCHER_PRICE_TOLERANCE{
        msg!("Error: invalid voucher price. True price is {}, {} posted", fee, args.fee);
        return Err(ProgramError::InvalidInstructionData);
    }
    let now_ts = Clock::get().unwrap().unix_timestamp as u64;
    if now_ts < neighborhood_metadata_data.voucher_live_date{
        msg!("Error: mint is not open");
        return Err(CustomError::NotOpenYet.into());
    }

    // transfer sol
    invoke(
        &system_instruction::transfer(
            user.key,
            neighborhood_creator.key,
            fee,
        ),
        &[
            user.clone(),
            neighborhood_creator.clone(),
            system_program.clone(),
        ],
    )?;

    //transfer vouchers
    invoke_signed(
        &spl_token::instruction::transfer(
            token_program.key,
            source_ata_voucher.key,
            user_ata_voucher.key,
            voucher_mint_auth.key,
            &[],
            args.count,
        )?,
        &[
            token_program.clone(),
            source_ata_voucher.clone(),
            user_ata_voucher.clone(),
            voucher_mint_auth.clone(),
        ],
        &[seeds_voucher_mint],
    )?;

    Ok(())
}