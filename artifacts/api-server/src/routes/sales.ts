import { sales } from "@workspace/db";
import { makePortfolioRouter } from "./_portfolio";

export default makePortfolioRouter("/sales", sales);
