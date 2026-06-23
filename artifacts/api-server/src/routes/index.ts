import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiChatRouter from "./aiChat";
import meRouter from "./me";
import bootstrapRouter from "./bootstrap";
import orgsRouter from "./orgs";
import membersRouter from "./members";
import contactsRouter from "./contacts";
import appointmentsRouter from "./appointments";
import marketLocationsRouter from "./marketLocations";
import assetsRouter from "./assets";
import dealsRouter from "./deals";
import developmentsRouter from "./developments";
import salesRouter from "./sales";
import acquisitionProfilesRouter from "./acquisitionProfiles";
import candidateDealsRouter from "./candidateDeals";
import screeningRouter from "./screening";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use(bootstrapRouter);
router.use(orgsRouter);
router.use(membersRouter);
router.use(contactsRouter);
router.use(appointmentsRouter);
router.use(marketLocationsRouter);
router.use(assetsRouter);
router.use(dealsRouter);
router.use(developmentsRouter);
router.use(salesRouter);
router.use(acquisitionProfilesRouter);
router.use(candidateDealsRouter);
router.use(screeningRouter);
router.use(aiChatRouter);

export default router;
