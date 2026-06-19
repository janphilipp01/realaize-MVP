import { developments } from "@workspace/db";
import { makePortfolioRouter } from "./_portfolio";

export default makePortfolioRouter("/developments", developments);
