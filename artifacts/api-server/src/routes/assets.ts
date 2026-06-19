import { assets } from "@workspace/db";
import { makePortfolioRouter } from "./_portfolio";

export default makePortfolioRouter("/assets", assets);
