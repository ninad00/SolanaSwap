#![allow(clippy::result_large_err)]
use anchor_lang::prelude::*;

pub mod constants;
pub mod make_offer;
pub mod offer;
pub mod shared;
pub mod take_offer;

pub use make_offer::*;
pub use take_offer::*;

declare_id!("GSYCrqvf4xw2mP4DdYbPwKsNiKfnhhTSyv8p7h1SX28R");

#[program]
pub mod swap {
    use super::*;
    pub fn make_offer(
        context: Context<MakeOffer>,
        id: u64,
        token_a_offered_amt: u64,
        token_b_wanted: u64,
    ) -> Result<()> {
        make_offer::send_offered_tokens_to_vault(&context, token_a_offered_amt)?;
        make_offer::save_offer(context, id, token_a_offered_amt,token_b_wanted)
    }

    pub fn take_offer(context: Context<TakeOffer>) -> Result<()> {
        take_offer::send_tokens_to_maker(&context)?;
        take_offer::withdraw_and_close_vault(&context)?;
        Ok(())
    }
}
