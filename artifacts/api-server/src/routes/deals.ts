import { deals } from "@workspace/db";
import { makePortfolioRouter } from "./_portfolio";

export default makePortfolioRouter("/deals", deals);
