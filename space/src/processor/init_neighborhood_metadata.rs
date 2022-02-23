use std::str;
use std::str::{FromStr};
use borsh::{BorshSerialize};
use solana_program::{
    account_info::{AccountInfo, next_account_info},
    borsh::try_from_slice_unchecked,
    entrypoint::ProgramResult,
    program_error::ProgramError,
    pubkey::Pubkey,
    msg,
    program::{invoke, invoke_signed},
    system_instruction, system_program,
    rent::Rent,
    sysvar::{Sysvar, rent},
};
use spl_token;

use crate::{
    instruction::InitNeighborhoodMetadataArgs,
    processor::processor_utils::{get_neighborhood_creation_price, get_space_xy_from_name, get_neighborhood_xy},
    state::{
        EXTEND_TOKEN_MINT,
        NEIGHBORHOOD_METADATA_SEED,
        NEIGHBORHOOD_METADATA_RESERVE,
        NEIGHBORHOOD_LIST_SEED,
        Base,
        NeighborhoodMetadata,
        NeighborhoodList,
    },
    validation_utils::{assert_keys_equal, assert_is_ata},
};

pub fn process(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: &InitNeighborhoodMetadataArgs,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();

    let base = next_account_info(account_info_iter)?;
    let neighborhood_metadata = next_account_info(account_info_iter)?;
    let neighborhood_list = next_account_info(account_info_iter)?;
    let candymachine_config = next_account_info(account_info_iter)?;
    let candymachine_account = next_account_info(account_info_iter)?;
    let creator = next_account_info(account_info_iter)?;
    let creator_ata_extend = next_account_info(account_info_iter)?;
    let extend_token_mint = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let rent_sysvar_info = next_account_info(account_info_iter)?;
    let rent = &Rent::from_account_info(rent_sysvar_info)?;
    
    if !creator.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // check programs
    assert_keys_equal(system_program::id(), *system_program.key)?;
    assert_keys_equal(spl_token::id(), *token_program.key)?;
    assert_keys_equal(rent::id(), *rent_sysvar_info.key)?;

    // verify neighborhood metadata
    let seeds_neighborhood_metadata = &[
        &base.key.to_bytes(),
        NEIGHBORHOOD_METADATA_SEED,
        &args.neighborhood_x.to_le_bytes(),
        &args.neighborhood_y.to_le_bytes(),
    ];
    let (key, bump_neighborhood_metadata) =
        Pubkey::find_program_address(seeds_neighborhood_metadata, program_id);
    assert_keys_equal(key, *neighborhood_metadata.key)?;
    let seeds_neighborhood_metadata = &[
        &base.key.to_bytes(),
        NEIGHBORHOOD_METADATA_SEED,
        &args.neighborhood_x.to_le_bytes(),
        &args.neighborhood_y.to_le_bytes(),
        &[bump_neighborhood_metadata],
    ];

    // verify neighborhood list account
    let mut neighborhood_list_data: NeighborhoodList = try_from_slice_unchecked(&neighborhood_list.data.borrow_mut())?;
    let seeds_neighborhood_list = &[
        &base.key.to_bytes(),
        NEIGHBORHOOD_LIST_SEED,
        &[neighborhood_list_data.bump],
    ];
    let key = Pubkey::create_program_address(seeds_neighborhood_list, program_id)?;
    assert_keys_equal(key, *neighborhood_list.key)?;

    // verify candymachine config matches neighborhood_x, neighborhood_y in the case of first name
    let config_data = candymachine_config.data.borrow();
    let name = unsafe { str::from_utf8_unchecked(&config_data[255..283]) };
    let (x, y) = get_space_xy_from_name(name);
    let (n_x, n_y) = get_neighborhood_xy(x,y);
    if !(n_x == args.neighborhood_x) || !(n_y == args.neighborhood_y) {
        msg!("Error: inputted incorrect config, with invalid spaces for the specified neighborhood");
        return Err(ProgramError::InvalidInstructionData);
    }

    let mut base_data: Base = try_from_slice_unchecked(&base.data.borrow_mut())?;

    // charge if not original creator during price exempt period
    if !((base_data.authority_privileges) && (*creator.key == base_data.authority)) {
        // check payment mint matches extend token
        assert_keys_equal(*extend_token_mint.key, Pubkey::from_str(EXTEND_TOKEN_MINT).unwrap())?;
        
        // check ATAs
        assert_is_ata(creator_ata_extend, creator.key, extend_token_mint.key)?;

        // check price    
        if args.price != get_neighborhood_creation_price(args.neighborhood_x, args.neighborhood_y) {
            msg!("Error: price invalid");
            return Err(ProgramError::MissingRequiredSignature); 
        }

        // burn the extend token
        invoke(
            &spl_token::instruction::burn(
                token_program.key,
                creator_ata_extend.key,
                extend_token_mint.key,
                creator.key,
                &[],
                args.price,
            )?,
            &[
                token_program.clone(),
                creator_ata_extend.clone(),
                extend_token_mint.clone(),
                creator.clone(),
            ],
        )?;

        // check creator of neighborhood matches candymachine creator
        let auth = Pubkey::new(&candymachine_config.data.borrow()[8..40]);
        assert_keys_equal(auth, *creator.key)?;
    }

    // check candymachine is not initialized
    if candymachine_account.data_len() != 0{
        msg!("Error: candymachine already initialized");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    // create the neighborhood metadata account
    let required_lamports = rent
        .minimum_balance(NEIGHBORHOOD_METADATA_RESERVE)
        .max(1)
        .saturating_sub(neighborhood_metadata.lamports());
    invoke_signed(
        &system_instruction::create_account(
            creator.key,
            neighborhood_metadata.key,
            required_lamports,
            NEIGHBORHOOD_METADATA_RESERVE as u64,
            program_id,
        ),
        &[
            creator.clone(),
            neighborhood_metadata.clone(),
            system_program.clone(),
        ],
        &[seeds_neighborhood_metadata],
    )?;

    // write to neighborhood metadata
    let mut neighborhood_metadata_data: NeighborhoodMetadata = try_from_slice_unchecked(&neighborhood_metadata.data.borrow_mut())?;
    neighborhood_metadata_data.bump = bump_neighborhood_metadata;
    neighborhood_metadata_data.creator = *creator.key;
    neighborhood_metadata_data.candymachine_config= *candymachine_config.key;
    neighborhood_metadata_data.candymachine_account = *candymachine_account.key;
    neighborhood_metadata_data.neighborhood_name = args.neighborhood_name;
    neighborhood_metadata_data.voucher_live_date = args.voucher_live_date;
    neighborhood_metadata_data.serialize(&mut *neighborhood_metadata.data.borrow_mut())?;
    
    // write to neighborhood list
    neighborhood_list_data.neighborhoods_x.push(args.neighborhood_x);
    neighborhood_list_data.neighborhoods_y.push(args.neighborhood_y);
    neighborhood_list_data.serialize(&mut *neighborhood_list.data.borrow_mut())?;

    // update base
    base_data.neighborhood_count += 1;
    base_data.serialize(&mut *base.data.borrow_mut())?;

    Ok(())
}
