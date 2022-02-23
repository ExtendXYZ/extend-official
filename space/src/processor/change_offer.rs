use borsh::{BorshSerialize};
use solana_program::{
    account_info::{AccountInfo, next_account_info},
    entrypoint::ProgramResult,
    borsh::try_from_slice_unchecked,
    msg,
    program::invoke,
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
};
use spl_token;

use crate::{
    error::CustomError,
    instruction::ChangeOfferArgs,
    state::{
        SPACE_METADATA_SEED,
        SELL_DELEGATE_SEED,
        SpaceMetadata,
    },
    validation_utils::{assert_is_ata, assert_keys_equal},
};

pub fn process(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: &ChangeOfferArgs,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let base = next_account_info(account_info_iter)?;
    let space_metadata = next_account_info(account_info_iter)?;
    let owner = next_account_info(account_info_iter)?;
    let owner_ata_space = next_account_info(account_info_iter)?;
    let sell_delegate = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;

    if !owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // check programs
    assert_keys_equal(spl_token::id(), *token_program.key)?;

    //deserialize and verify space metadata
    let mut space_metadata_data: SpaceMetadata = try_from_slice_unchecked(&space_metadata.data.borrow_mut())?;

    let seeds_space_metadata = &[
        &base.key.to_bytes(),
        SPACE_METADATA_SEED,
        &args.space_x.to_le_bytes(),
        &args.space_y.to_le_bytes(),
        &[space_metadata_data.bump],
    ];
    let key = Pubkey::create_program_address(seeds_space_metadata, program_id)?;
    assert_keys_equal(key, *space_metadata.key)?;

    //verify sell delegate
    let seeds_sell_delegate = &[&base.key.to_bytes(), SELL_DELEGATE_SEED];
    let (key, _) = Pubkey::find_program_address(seeds_sell_delegate, program_id);
    assert_keys_equal(key, *sell_delegate.key)?;

    //check ATAs
    assert_is_ata(owner_ata_space, owner.key, &space_metadata_data.mint)?;

    // check NFT owned
    let ata_data = spl_token::state::Account::unpack_from_slice(&owner_ata_space.data.borrow())?;
    if ata_data.amount != 1 {
        msg!("Error: token account does not own token");
        return Err(CustomError::MissingTokenOwner.into());
    }

    // main code
    if args.create {
        // approve delegate
        invoke(
            &spl_token::instruction::approve(
                token_program.key,
                owner_ata_space.key,
                sell_delegate.key,
                owner.key,
                &[],
                1,
            )?,
            &[
                token_program.clone(),
                owner_ata_space.clone(),
                sell_delegate.clone(),
                owner.clone(),
            ],
        )?;
    } else {
        // revoke delegate
        invoke(
            &spl_token::instruction::revoke(token_program.key, owner_ata_space.key, owner.key, &[])?,
            &[token_program.clone(), owner_ata_space.clone(), owner.clone()],
        )?;
    }

    // write to space data
    if args.create {
        // if creating sell offer, set price
        space_metadata_data.price = args.price;
    }
    else{
        space_metadata_data.price = 0;
    }

    space_metadata_data.serialize(&mut *space_metadata.data.borrow_mut())?;

    Ok(())
}
