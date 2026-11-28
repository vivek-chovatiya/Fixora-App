/**
 * Vendor copy
 *
 * Every string the vendor application shows, in one place — for the reasons
 * `CUSTOMER_COPY` gives: copy is revised by people who do not read JSX, and one
 * file is what multi-language translates later.
 *
 * ⚠️ Nothing here may name a service category (PROJECT_BIBLE.md section 11).
 *
 * In English, Hindi and Gujarati since Phase 5 (28/11/2026, phase5-contract.md
 * section 7): `VENDOR_COPY_EN` is the source, `vendorCopy.hi.ts` and
 * `vendorCopy.gu.ts` translate it, and `VENDOR_COPY` answers in the current
 * language, key by key, falling back to English (`core/i18n`).
 *
 * ⚠️ Read it in render. A string taken from `VENDOR_COPY` while a module loads
 * keeps the language of that moment; a section (`VENDOR_COPY.dashboard`) may be
 * held anywhere.
 */

import { localized } from '@/core/i18n';
import { VENDOR_COPY_GU } from '@/features/vendor/constants/vendorCopy.gu';
import { VENDOR_COPY_HI } from '@/features/vendor/constants/vendorCopy.hi';

export const VENDOR_COPY_EN = Object.freeze({
  /** Deciding whether setup is needed, before either the form or the app appears. */
  gate: Object.freeze({
    loading: 'Loading your business profile',
    failedTitle: 'We could not load your business profile',
  }),

  profileForm: Object.freeze({
    setupTitle: 'Set up your business',
    setupSubtitle:
      'Tell customers who you are and what you do. You can change any of this later.',
    editTitle: 'Edit business profile',
    editSubtitle: 'Changes are shown to customers as soon as you save.',
    back: 'Back to profile',

    photoSection: 'Business photo',
    photoSupport: 'Optional. Your shop front, your van or your logo.',
    photoCamera: 'Take a photo',
    photoGallery: 'Choose a photo',
    /** Spoken, so the action names what it does to the business's picture. */
    photoAddCameraSpoken: 'Add profile image with the camera',
    photoAddGallerySpoken: 'Add profile image from your photos',
    photoReplaceCameraSpoken: 'Replace profile image with the camera',
    photoReplaceGallerySpoken: 'Replace profile image from your photos',
    photoRemove: 'Remove photo',
    photoRemoveSpoken: 'Remove profile image',
    /**
     * Said once as an upload starts, and shown until the upload reports how
     * far it has got; from then the line is `photoProgress` (Phase 3G-4).
     */
    photoUploading: 'Uploading your photo…',
    /** The upload's own figure, beside its bar. Not announced as it changes. */
    photoProgress: (percent: number) => `Uploading… ${percent}%`,
    photoFailedTitle: 'Your photo was not uploaded',
    photoRetry: 'Try again',
    photoDiscard: 'Discard',
    photoDiscardHint: 'Forgets the photo that did not upload',
    photoSpoken: 'Business photo',

    businessSection: 'Your business',
    businessNameLabel: 'Business name',
    businessNamePlaceholder: 'e.g. Kumar Electricals',
    descriptionLabel: 'Description',
    descriptionPlaceholder: 'What you do, how long you have done it, what you are known for',
    descriptionHelper: 'Optional',

    servicesSection: 'Services you offer',
    categoriesLabel: 'Service categories',

    areaSection: 'Where you work',
    areaLabel: 'Service area',
    areaPlaceholder: 'e.g. Koramangala, HSR Layout and Indiranagar',
    areaHelper: 'Optional. The neighbourhoods or city you take jobs in.',

    contactSection: 'Contact',
    contactSupport: 'From your account. Customers reach you on these.',
    ownerLabel: 'Owner',
    phoneLabel: 'Phone',
    emailLabel: 'Email',

    saveSetup: 'Finish setup',
    saveEdit: 'Save profile',
    saving: 'Saving…',
    saveHint: 'Saves your business profile',
    saveFailedTitle: 'Your profile was not saved',
    /** Said when Save is pressed with the form invalid, so nothing happens silently. */
    fixErrors: 'Check the highlighted fields.',

    signOut: 'Sign out',
    signOutHint: 'Signs out without finishing setup',

    discardTitle: 'Discard your changes?',
    discardMessage: 'Your changes to the business profile have not been saved.',
    discardKeep: 'Keep editing',
    discardKeepHint: 'Returns to the form',
    discardConfirm: 'Discard',
    discardConfirmHint: 'Leaves without saving',
  }),

  validation: Object.freeze({
    businessNameRequired: 'Enter your business name.',
    businessNameTooLong: (max: number) => `The business name must be ${max} characters or fewer.`,
    descriptionTooLong: (max: number) => `The description must be ${max} characters or fewer.`,
    areaTooLong: (max: number) => `The service area must be ${max} characters or fewer.`,
    categoriesRequired: 'Select at least one service you offer.',

    /**
     * A team member's details (Phase 3E-7). Phone messages are the shared phone
     * rule's. The role has no "required" message since it became optional
     * (phase5-contract.md section 4, T137, 28/11/2026) — only its ceiling.
     */
    memberNameRequired: 'Enter their name.',
    memberNameTooLong: (max: number) => `The name must be ${max} characters or fewer.`,
    memberRoleTooLong: (max: number) => `The role must be ${max} characters or fewer.`,

    /**
     * Completing a job (sections 36 and 37). The amount's ceiling arrives
     * already written as money ("₹10,00,000"), so no sentence here names a
     * currency.
     */
    amountRequired: 'Enter the final amount.',
    amountFormat: 'Enter the amount in numbers only, like 1250 or 1250.50.',
    amountTooSmall: 'The final amount must be more than 0.',
    amountTooLarge: (max: string) => `The final amount must be ${max} or less.`,
    paymentStatusRequired: 'Choose whether the customer has paid.',
    paymentMethodRequired: 'Choose how the customer paid.',
    completionNotesTooLong: (max: number) => `The notes must be ${max} characters or fewer.`,
  }),

  /** The dashboard (PROJECT_BIBLE.md section 30, Phase 3E-2). */
  dashboard: Object.freeze({
    greetingMorning: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',
    /** For an account with no owner name on it. */
    greetingFallbackName: 'there',

    /** The business card, which is also the way to the Profile tab. */
    businessServicesLabel: 'Services',
    businessAreaLabel: 'Service area',
    businessHint: 'Opens your business profile',

    overviewTitle: 'Overview',
    pendingLabel: 'Pending',
    activeLabel: 'Active',
    completedLabel: 'Completed',
    /** Spoken, because "Pending, 4" does not say four of what. */
    pendingSpoken: (count: number) =>
      count === 1 ? '1 request waiting for you' : `${count} requests waiting for you`,
    activeSpoken: (count: number) =>
      count === 1 ? '1 job under way' : `${count} jobs under way`,
    completedSpoken: (count: number) =>
      count === 1 ? '1 job completed' : `${count} jobs completed`,
    /**
     * A count the app could not read to the end (`VendorDashboardCounts.isLowerBound`,
     * code review 17/11/2026): "400+" drawn, "at least 400 …" said — never an exact-looking number.
     */
    countAtLeast: (count: number) => `${count}+`,
    atLeastSpoken: (spoken: string) => `at least ${spoken}`,

    loading: 'Loading your dashboard',
    failedTitle: 'We could not load your dashboard',

    pendingTitle: 'New requests',
    pendingEmptyTitle: 'No new requests',
    pendingEmptyMessage: 'New service requests will appear here.',

    activeTitle: 'Active work',
    activeEmptyTitle: 'No active work',
    activeEmptyMessage: 'Requests you accept will appear here while you work on them.',

    completedTitle: 'Recently completed',
    completedEmptyTitle: 'No completed work yet',
    completedEmptyMessage: 'Work you finish will appear here.',

    seeAll: 'See all',
    /** "See all", heard alone, says nothing about what it will show. */
    seeAllPendingSpoken: 'See all new requests',
    seeAllActiveSpoken: 'See all active work',
    seeAllCompletedSpoken: 'See all completed work',
    seeAllHint: 'Opens your requests',

    /**
     * Section 30's Today's Requests and Rating (Phase 3E-15). Each is read on
     * its own and fails on its own, so each has its own words for waiting and
     * for failing; the figures themselves are the report's and the reviews'.
     */
    todayLabel: "Today's requests",
    /** "Today's requests, 3" — or "…, not available" for a figure that is not a count. */
    todaySpoken: (value: string) => `Today's requests, ${value}`,
    todayLoading: "Loading today's requests",
    todayFailedTitle: "We could not load today's requests",
    /** Holds the visible "Try again", so voice control still finds it by its word. */
    todayRetrySpoken: "Try again to load today's requests",
    todayRetryHint: "Loads today's requests again",

    /** The rating's own words are the reviews' (`reviews.figure…`), shared with Profile. */
    ratingHint: 'Opens your reviews',
    ratingLoading: 'Loading your rating',
    ratingFailedTitle: 'We could not load your rating',
    ratingRetrySpoken: 'Try again to load your rating',
    ratingRetryHint: 'Loads your rating again',
    /** On a figure's own retry; the spoken name says which figure. */
    figureRetry: 'Try again',

    /**
     * A read that failed while its figures were on screen — the work, today's
     * requests or the rating, whether pulled or read again on returning to the
     * tab. One notice for the page, as on the request list (3E-3).
     */
    staleTitle: 'Could not refresh',
    staleMessage: 'Your dashboard may be out of date.',
    staleRetry: 'Try again',
    staleRetryHint: 'Loads your dashboard again',
  }),

  /** One request on a vendor's card (section 31's fields). */
  job: Object.freeze({
    referencePrefix: 'Ref',
    statusLabel: 'Status',
    customerLabel: 'Customer',
    /**
     * Said in the customer's place on a card the vendor does not hold yet —
     * waiting or declined (owner decision, 21/10/2026): "Area: Koramangala".
     */
    areaLabel: 'Area',
    priorityLabel: 'Priority',
    raisedLabel: 'Raised',
    completedLabel: 'Completed',
    /** A declined request is dated by when the vendor declined it (2026-10-21). */
    rejectedLabel: 'Rejected',
    /** After one of those labels, in place of the shared "Just now". */
    justNow: 'just now',

    /** Waiting for this vendor, by how it reached them (section 31.1). */
    statusDirected: 'Direct request',
    statusBroadcast: 'Open request',
    /** Waiting, when the backend does not say how it arrived. */
    statusNew: 'New',
    statusAccepted: 'Accepted',
    statusInProgress: 'In progress',
    statusCompleted: 'Completed',
    statusRejected: 'Rejected',
    /**
     * The customer withdrew it (section 21's `CANCELLED`). Reached by opening
     * it — from its push, say — since a cancelled request is in no list.
     */
    statusCancelled: 'Cancelled',
    /** A status the app does not recognise. Says so, and guesses nothing. */
    statusUnknown: 'Status unavailable',

    /** On a card that opens its request. */
    openHint: 'Opens this request',
  }),

  /** The request list (PROJECT_BIBLE.md section 31, Phase 3E-3). */
  requests: Object.freeze({
    title: 'Requests',
    subtitle: 'Work that is waiting for you, under way and done.',

    filtersLabel: 'Show requests',
    filterHint: 'Shows these requests',
    /** The same three words as the dashboard's tiles, so a count there is a filter here. */
    filterAll: 'All',
    filterPending: 'Pending',
    filterActive: 'Active',
    filterCompleted: 'Completed',
    /**
     * What the vendor declined (section 31's Rejected tab, 2026-10-21). The
     * badge's word, so the chip and the cards under it agree. Not a dashboard
     * tile, and not part of All.
     */
    filterRejected: 'Rejected',

    /** Headings inside All, with how many are under each. */
    groupPending: 'Pending',
    groupActive: 'Active',
    groupCompleted: 'Completed',
    groupSpoken: (group: string, count: number) =>
      count === 1 ? `${group}, 1 request` : `${group}, ${count} requests`,

    loadingLabel: 'Loading your requests',
    failedTitle: 'We could not load your requests',

    emptyAllTitle: 'No requests yet',
    emptyAllMessage: 'New service requests will appear here.',
    emptyPendingTitle: 'No pending requests',
    emptyPendingMessage: 'Requests waiting for your answer will appear here.',
    emptyActiveTitle: 'No active work',
    emptyActiveMessage: 'Requests you accept will appear here while you work on them.',
    emptyCompletedTitle: 'No completed requests yet',
    emptyCompletedMessage: 'Work you finish will appear here.',
    emptyRejectedTitle: 'No rejected requests',
    emptyRejectedMessage: "You haven't declined any requests.",

    /** A pull that failed over a list that is still on screen. */
    staleTitle: 'Could not refresh',
    staleMessage: 'These requests may be out of date.',
    staleRetry: 'Try again',
    staleRetryHint: 'Loads your requests again',
  }),

  /** Accepting or rejecting a waiting request (section 33, Phase 3E-4). */
  answer: Object.freeze({
    accept: 'Accept',
    reject: 'Reject',
    /**
     * Spoken, because "Accept" five times down a list says nothing about which
     * request it takes. Always starts with the word on the button, so voice
     * control still finds it.
     */
    /** The reference is left out when the backend gave none — never the database id in its place. */
    acceptSpoken: (service: string, reference?: string) =>
      reference ? `Accept ${service}, ${reference}` : `Accept ${service}`,
    rejectSpoken: (service: string, reference?: string) =>
      reference ? `Reject ${service}, ${reference}` : `Reject ${service}`,
    acceptHint: 'Takes this job',
    rejectHint: 'Asks before declining this request',

    /** On the details screen, above the two buttons. */
    section: 'Your answer',
    promptDirected: 'The customer chose you. Accept to take the job, or reject it if you cannot do it.',
    promptBroadcast:
      'Other professionals can see this request too. The first to accept it gets the job.',
    prompt: 'Accept to take the job, or reject it if you cannot do it.',

    rejectTitle: 'Reject request?',
    /**
     * What rejecting costs, and where the request goes. It used to say the
     * request would "no longer be available" — true of taking it, but since
     * 21/10/2026 a declined request stays in the vendor's Rejected list, and
     * "no longer available" read as if it vanished.
     */
    rejectMessage: "You won't be able to take it after this. It will stay in your Rejected list.",
    rejectCancel: 'Cancel',
    rejectCancelHint: 'Keeps the request',
    rejectConfirm: 'Reject',
    rejectConfirmHint: 'Declines this request',

    /** After the service confirmed it. Never before (section 33.1). */
    accepted: 'Request accepted. It is now in your active work.',
    rejected: 'Request rejected.',
    /** Lost the race on an open request (sections 33.1 and 49.1): information, not a fault. */
    taken: 'This request is no longer available. Another professional accepted it first.',
    /** Answered already, from somewhere else, or moved on since. */
    notPending: 'This request is no longer waiting for an answer.',
    /** Not this vendor's to answer any more. */
    unavailable: 'This request is no longer available.',
    /** Said before the failure's own message; nothing was changed. */
    acceptFailed: 'The request was not accepted.',
    rejectFailed: 'The request was not rejected.',
  }),

  /** Moving accepted work along (sections 35 and 36, Phase 3E-5). */
  work: Object.freeze({
    start: 'Start work',
    complete: 'Mark completed',
    /**
     * Spoken, naming the job. Each starts with the words on the button, so voice
     * control still finds it by what it can see.
     */
    /** As `answer.acceptSpoken`: no reference, none said. */
    startSpoken: (service: string, reference?: string) =>
      reference ? `Start work on ${service}, ${reference}` : `Start work on ${service}`,
    completeSpoken: (service: string, reference?: string) =>
      reference ? `Mark completed: ${service}, ${reference}` : `Mark completed: ${service}`,
    startHint: 'Marks this job as in progress',
    /** It opens the completion form now; nothing is completed by this press. */
    completeHint: 'Opens the form to record the final amount and payment',

    /** On the details screen, above the button. */
    section: 'Your work',
    promptStart: 'Start work when you begin the job.',
    promptComplete:
      'Mark the job completed when the work is done. You will record the final amount and payment.',

    completeTitle: 'Complete this job?',
    /** Asked last, from the completion form: there is no step back from it. */
    completeMessage:
      'This will mark the request as completed and save the payment details. It cannot be undone.',
    completeCancel: 'Cancel',
    completeCancelHint: 'Keeps the job in progress',
    completeConfirm: 'Complete',
    completeConfirmHint: 'Marks this job completed',

    /** After the service confirmed it. */
    started: 'Work started. This job is now in progress.',
    completed: 'Job completed. It is now in your completed work.',
    /** The job moved on elsewhere before the step reached it. */
    changed: 'This job has already changed. Showing its latest status.',
    /** Said before the failure's own message; nothing was changed. */
    startFailed: 'Work was not started.',
    completeFailed: 'The job was not marked completed.',

    /**
     * A payment recorded after the job (owner decision, 21/10/2026). Said by
     * the same hook as the steps above, so it sits with them.
     */
    paymentRecorded: 'Payment recorded. This job is now marked paid.',
    /** Said before the failure's own message; the record was not changed. */
    recordPaymentFailed: 'The payment was not recorded.',
  }),

  /**
   * The completion form (sections 36 and 37): the final amount and the offline
   * payment record, then the confirmation in `work`.
   *
   * ⚠️ Recorded, never processed (section 37). Nothing here says Fixora took,
   * received or confirmed a payment; the vendor is writing down what happened.
   * The status words ("Paid", "Not paid yet") are the shared
   * `presentation/payment` table's, so the customer reads the same ones.
   */
  completeForm: Object.freeze({
    title: 'Complete work',
    subtitle:
      'Record what the job came to and whether the customer has paid you. Fixora does not process payments.',
    /** It goes back to wherever the form was opened from: the request, or the list. */
    back: 'Back',

    amountLabel: 'Final amount',
    amountPlaceholder: 'e.g. 1250',
    amountHelper: 'The total for the job. Use a point for paise, like 1250.50.',

    statusLabel: 'Payment status',
    statusHint: 'Sets whether the customer has paid',

    methodLabel: 'Payment method',
    methodHint: 'Sets how the customer paid',
    methodsLoading: 'Loading payment methods',
    /** Said before the failure's own message. The rest of the form still works. */
    methodsFailed: 'The payment methods did not load.',
    /** The service answered with none — a configuration gap, not the vendor's to fix. */
    methodsNone: 'No payment methods are available right now.',
    methodsRetry: 'Try again',
    methodsRetryHint: 'Loads the payment methods again',

    notesLabel: 'Completion notes',
    notesPlaceholder: 'What was done, parts used, anything to remember about the job',
    notesHelper: 'Optional',

    submit: 'Complete work',
    submitHint: 'Asks before marking this job completed',
    /** Said when the button is pressed with the form invalid, so nothing happens silently. */
    fixErrors: 'Check the highlighted fields.',

    discardTitle: 'Discard this completion?',
    discardMessage: 'The amount and payment details you entered have not been saved.',
    discardKeep: 'Keep editing',
    discardKeepHint: 'Returns to the form',
    discardConfirm: 'Discard',
    discardConfirmHint: 'Leaves without completing the job',
  }),

  /** What was recorded on completion, on a completed request's details. */
  payment: Object.freeze({
    section: 'Payment',
    amountLabel: 'Final amount',
    statusLabel: 'Payment status',
    notesLabel: 'Completion notes',
    /** Recorded, never processed (section 37) — and the vendor's own record. */
    recorded: 'Recorded by you. Fixora does not process payments.',

    /**
     * On a record still "Not paid yet": the way to say the customer has paid
     * since (owner decision, 21/10/2026). It opens a form; nothing is changed by
     * this press.
     */
    recordPayment: 'Record payment',
    recordPaymentHint: 'Opens the form to record how the customer paid',
  }),

  /**
   * Recording a payment after the job (owner decision, 21/10/2026): "Not paid
   * yet" becomes "Paid", with how. The method field's own words are the
   * completion form's (`completeForm.method…`), because it is the same field.
   *
   * ⚠️ Recorded, never processed (section 37), and final: the subtitle says
   * both before anything is sent.
   */
  recordPaymentForm: Object.freeze({
    title: 'Record payment',
    subtitle:
      'Record how the customer paid you for this job. Once it is marked paid, it cannot be changed. Fixora does not process payments.',
    back: 'Back',

    submit: 'Record payment',
    submitHint: 'Asks before marking this job paid',
    /** Said when the button is pressed with no method chosen, so nothing happens silently. */
    fixErrors: 'Check the highlighted fields.',

    /**
     * Asked once more before anything is sent (lead decision, 21/10/2026): a
     * paid record is final, as a completion is. The title names the method
     * chosen, so the question is about this payment and no other.
     */
    confirmTitle: (method: string) => `Mark as paid by ${method}?`,
    /** When the method's name is not to hand — never the method's id. */
    confirmTitlePlain: 'Mark this job as paid?',
    confirmMessage: "This can't be changed later.",
    confirmCancel: 'Cancel',
    confirmCancelHint: 'Keeps the payment as not paid yet',
    confirmConfirm: 'Mark as paid',
    confirmConfirmHint: 'Records this job as paid',

    discardTitle: 'Discard this payment?',
    discardMessage: 'The payment method you chose has not been saved.',
    discardKeep: 'Keep editing',
    discardKeepHint: 'Returns to the form',
    discardConfirm: 'Discard',
    discardConfirmHint: 'Leaves without recording the payment',
  }),

  /** One request, opened (section 32, Phase 3E-3), and answered (3E-4). */
  requestDetails: Object.freeze({
    /**
     * Not "Back to requests": the notifications inbox (from the dashboard's
     * bell) opens this screen too, and from there Back does not go to the
     * list (found on the emulator, 20/10/2026). The customer's details say
     * "Back" for the same reason.
     */
    back: 'Back',
    loading: 'Loading this request',
    failedTitle: 'We could not load this request',
    notFoundTitle: 'This request is not available',
    notFoundMessage: 'It may have been taken by someone else, or it is no longer open to you.',

    requestSection: 'Request',
    referenceLabel: 'Reference',
    /**
     * The copy button beside the reference (T135, 28/11/2026). A glyph on
     * screen, so its spoken name says what it copies; the customer's details
     * word it the same way.
     */
    copyReference: (reference: string) => `Copy reference ${reference}`,
    copyReferenceHint: 'Copies the reference to the clipboard',
    /** Shown beside the button for a moment once the reference is on the clipboard. */
    copied: 'Copied',
    copyFailed: 'We could not copy the reference. You can write it down instead.',
    categoryLabel: 'Category',
    serviceLabel: 'Service',
    statusLabel: 'Status',
    priorityLabel: 'Priority',
    raisedLabel: 'Raised',
    completedLabel: 'Completed',
    /** When the vendor declined it, on a request they rejected (2026-10-21). */
    rejectedLabel: 'Rejected',

    originLabel: 'How it reached you',
    originDirected: 'The customer chose you for this request.',
    originBroadcast: 'Sent to every professional who offers this service.',

    /** When the customer would like the work done (section 32), as they chose it. */
    preferredDateLabel: 'Preferred date',
    preferredTimeLabel: 'Preferred time',
    /** The two days a preferred date is called by name (`formatDateValue`). */
    today: 'Today',
    tomorrow: 'Tomorrow',

    /**
     * Who the customer is — drawn only once the vendor holds the work (owner
     * decision, 21/10/2026). No call button: section 32 lists the information,
     * not a way to ring it.
     */
    customerSection: 'Customer',
    customerLabel: 'Name',
    phoneLabel: 'Phone',

    /** Where the work is: the area before the vendor accepts; the full address after. */
    locationSection: 'Location',
    localityLabel: 'Area',
    addressLabel: 'Address',
    /** On a request still waiting for their answer, so a missing address is not a mystery. */
    withheldNote: 'The customer’s name, phone number and full address are shared once you accept.',

    /** The customer's photographs (section 32, "Images"), counted as the customer's own screens count them. */
    photosLabel: 'Photos',
    photoCountOne: '1 photo attached',
    photoCountMany: 'photos attached',
    /** Follows a count: "2 photos attached, 1 could not be shown". */
    photoUnavailable: 'could not be shown',

    descriptionSection: 'What the customer said',
    descriptionMissing: 'The customer did not add a description.',
  }),

  /**
   * The vendor's reviews (PROJECT_BIBLE.md section 41, Phase 3E-6). Read-only:
   * nothing here replies to, reports or changes a review.
   */
  reviews: Object.freeze({
    title: 'Reviews',
    subtitle: 'What customers said about your work.',
    /**
     * Not "Back to profile": since Phase 3E-15 the dashboard's rating opens
     * this screen too, and Back goes wherever the vendor came from.
     */
    back: 'Back',

    summaryTitle: 'Overall rating',
    /** Under the average: how many reviews it comes from. */
    count: (count: number) => (count === 1 ? '1 review' : `${count} reviews`),
    /**
     * The whole summary as one sentence, the average said as a number — five
     * star glyphs heard one by one would say nothing.
     */
    summarySpoken: (average: string, max: number, count: number) =>
      `Rating ${average} out of ${max}, based on ${count === 1 ? '1 review' : `${count} reviews`}.`,

    /**
     * Section 41's breakdown, one row per number of stars: "5 ★ ▬▬ 80%". The
     * number is drawn beside a star glyph, and the percentage after the bar.
     */
    breakdownPercent: (percent: number) => `${percent}%`,
    /**
     * The widest a percentage can be drawn. Never shown: it holds the column
     * open so every row's bar is the same length and "100%" is never clipped.
     */
    breakdownPercentWidest: '100%',
    /**
     * A row said as one sentence — stars, share, then how many — because a bar
     * says nothing to a screen reader: "5 stars, 80 percent, 12 reviews".
     */
    breakdownRowSpoken: (stars: number, percent: number, count: number) =>
      `${stars === 1 ? '1 star' : `${stars} stars`}, ${percent} percent, ${
        count === 1 ? '1 review' : `${count} reviews`
      }`,

    /** Joins a review's service and its reference on one line. */
    contextSeparator: ' · ',
    /** Said first on a card, so whose review it is comes before what it says. */
    fromSpoken: (name: string) => `Review from ${name}`,
    /** A review the backend gives no name for. Says it is a review and no more. */
    anonymousSpoken: 'Customer review',
    /**
     * After the last name's initial: "Priya S." (owner decision, 21/10/2026 —
     * a vendor sees a reviewer's first name and last initial, never the surname).
     */
    reviewerInitialMark: '.',
    /** Before the customer's own words, so they are heard as theirs. */
    commentSpoken: 'Comment',

    /**
     * The rating as a figure elsewhere — the dashboard's card and the Profile
     * tab's reviews row (Phase 3E-15) — worded by `presentRatingFigure`. This
     * one stands above "No reviews yet", where there is no average to draw.
     */
    figureLabel: 'Rating',
    /** Never "0.0": no reviews is not a rating of nothing. */
    figureNone: 'No reviews yet',
    figureNoneSpoken: 'Rating, no reviews yet',
    /** Reviews counted but no average the app can trust: the count alone, said as such. */
    figureCountOnlySpoken: (count: string) => `Rating, ${count}`,

    loading: 'Loading your reviews',
    failedTitle: 'We could not load your reviews',

    /**
     * Section 48's words, and a sentence that promises nothing: a customer may
     * review finished work, and need not.
     */
    emptyTitle: 'No reviews yet',
    emptyMessage: 'When customers review your completed work, their reviews will appear here.',

    /** A pull that failed over reviews that are still on screen (as on the request list). */
    staleTitle: 'Could not refresh',
    staleMessage: 'These reviews may be out of date.',
    staleRetry: 'Try again',
    staleRetryHint: 'Loads your reviews again',
  }),

  /**
   * The vendor's basic report (PROJECT_BIBLE.md section 42): five figures for
   * one period. Words only — every figure is the server's, and nothing here
   * names money, a rate or a trend (section 42: no financial analytics).
   */
  reports: Object.freeze({
    title: 'Reports',
    subtitle: 'Your requests and rating for the period you choose.',
    back: 'Back to profile',

    /** Section 42's time filters, said as one of three. */
    periodsLabel: 'Report period',
    periodHint: 'Shows the figures for this period',
    periodToday: 'Today',
    periodWeek: 'This week',
    periodMonth: 'This month',

    total: 'Total requests',
    completed: 'Completed',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    /** Said in full, because "Completed, 12" leaves twelve of what unsaid. */
    totalSpoken: 'Total requests',
    completedSpoken: 'Completed requests',
    rejectedSpoken: 'Rejected requests',
    cancelledSpoken: 'Cancelled requests',
    /** One figure as one phrase: "Completed requests, 12". */
    figureSpoken: (name: string, value: string) => `${name}, ${value}`,
    /**
     * A count the server sent that is not a count. Drawn as a dash and said as
     * words — never as a zero, which would be a figure nobody gave.
     */
    unavailable: '—',
    unavailableSpoken: 'not available',

    rating: 'Average rating',
    /** Under the average: how many ratings it comes from. */
    ratingCount: (count: number) => (count === 1 ? 'from 1 rating' : `from ${count} ratings`),
    /** The whole rating card as one phrase, the average said as a number. */
    ratingSpoken: (average: string, max: number, count: number) =>
      `Average rating ${average} out of ${max}, from ${count === 1 ? '1 rating' : `${count} ratings`}`,
    /** No ratings in the period: said in words, never drawn as 0.0. */
    noRatings: 'No ratings yet',
    noRatingsSpoken: 'Average rating, no ratings yet',

    /** Under the figures when nothing reached the vendor in the period. Zeros are figures, not a fault. */
    noRequests: 'No requests in this period yet.',

    loading: 'Loading your report',
    failedTitle: 'We could not load your report',

    /** A pull that failed over figures that are still on screen (as on the request list). */
    staleTitle: 'Could not refresh',
    staleMessage: 'These figures may be out of date.',
    staleRetry: 'Try again',
    staleRetryHint: 'Loads this report again',
  }),

  /**
   * The vendor's team (PROJECT_BIBLE.md section 39, Phase 3E-7). A list the
   * vendor keeps: nothing here assigns work, invites anybody or signs them in.
   */
  team: Object.freeze({
    title: 'Team',
    subtitle: 'The people who work with you.',

    add: 'Add team member',
    addHint: 'Opens a form to add someone to your team',

    loading: 'Loading your team',
    failedTitle: 'We could not load your team',

    /** Section 48's sentence, and its action. */
    emptyTitle: 'No team members yet',
    emptyMessage: "You haven't added any team members yet.",

    phoneLabel: 'Phone',
    /**
     * A member's details, said as one sentence. The role is optional (T137,
     * 28/11/2026): without one the sentence is the name, never "Asha, ."
     */
    memberSpoken: (name: string, role?: string, phone?: string) => {
      const who = role ? `${name}, ${role}` : name;
      return phone ? `${who}. Phone ${phone}` : who;
    },

    /**
     * Section 39's status, as the team shows it (`teamMemberStatus.ts`).
     * Active is the ordinary state, so a card draws nothing for it; the edit
     * form names it. A status the app does not know is "Status unavailable",
     * as an unknown request status is (3E-3) — never the backend's raw word.
     */
    statusActive: 'Active',
    statusDisabled: 'Disabled',
    statusUnknown: 'Status unavailable',
    /** The details sentence with the status after it: "Farhan Ali, Helper. Disabled". */
    memberWithStatusSpoken: (details: string, status: string) => `${details}. ${status}`,

    /**
     * Spoken, naming the member, because "Edit" and "Remove" down a list say
     * nothing about whom. Each starts with the word on the button, so voice
     * control still finds it.
     */
    edit: 'Edit',
    editSpoken: (name: string) => `Edit ${name}`,
    editHint: 'Opens this team member to change their details',
    remove: 'Remove',
    removeSpoken: (name: string) => `Remove ${name}`,
    removeHint: 'Asks before removing this team member',

    removeTitle: 'Remove team member?',
    removeMessage: (name: string) => `${name} will be removed from your team.`,
    removeCancel: 'Cancel',
    removeCancelHint: 'Keeps this team member',
    removeConfirm: 'Remove',
    removeConfirmHint: 'Removes this team member from your team',

    /** After the service confirmed it. */
    removed: 'Team member removed.',
    /** Said before the failure's own message; nobody was removed. */
    removeFailed: 'The team member was not removed.',

    /** A pull that failed over a team that is still on screen (as on the request list). */
    staleTitle: 'Could not refresh',
    staleMessage: 'Your team may be out of date.',
    staleRetry: 'Try again',
    staleRetryHint: 'Loads your team again',
  }),

  /** Adding or changing one team member (Phase 3E-7). One form for both. */
  teamForm: Object.freeze({
    addTitle: 'Add team member',
    addSubtitle: 'Keep their details in one place. Team members do not sign in to Fixora.',
    editTitle: 'Edit team member',
    editSubtitle: 'Change their details, then save.',
    back: 'Back to team',

    nameLabel: 'Name',
    namePlaceholder: 'Their full name',
    roleLabel: 'Role',
    rolePlaceholder: 'e.g. Senior technician',
    /** Optional since T137 (28/11/2026), said the way the phone below it says so. */
    roleHelper: 'Optional',
    phoneLabel: 'Phone number',
    phonePlaceholder: 'Their phone number',
    phoneHelper: 'Optional',

    /**
     * Section 39's Profile Image, at the top of the form (2026-10-21). Since
     * T136 (28/11/2026) one button — "Add photo", or "Change photo" once there
     * is one — opens a sheet of what can be done: choose from the gallery, take
     * a photo, and remove the one there is (only then). The picture itself is
     * not a stop for a screen reader: the button's words already say whether
     * there is one.
     */
    photoSection: 'Photo',
    photoSupport: 'Optional. A clear photo of their face.',
    photoAdd: 'Add photo',
    photoChange: 'Change photo',
    photoOptionsHint: 'Opens the photo options',
    photoSheetTitle: 'Their photo',
    photoGallery: 'Choose from gallery',
    photoGalleryHint: 'Opens your photos to choose one',
    photoCamera: 'Take photo',
    photoCameraHint: 'Opens the camera',
    photoRemove: 'Remove photo',
    photoRemoveHint: 'Takes their photo off this form. Save to keep the change.',
    photoCancel: 'Cancel',
    photoCancelHint: 'Closes the photo options',
    photoUploading: 'Uploading the photo…',
    /** As the business picture's (`profileForm.photoProgress`). */
    photoProgress: (percent: number) => `Uploading… ${percent}%`,
    photoFailedTitle: 'The photo was not uploaded',
    photoRetry: 'Try again',
    photoDiscard: 'Discard',
    photoDiscardHint: 'Forgets the photo that did not upload',

    saveAdd: 'Add team member',
    saveEdit: 'Save changes',
    saving: 'Saving…',
    saveAddHint: 'Adds this person to your team',
    saveEditHint: 'Saves this team member’s details',
    saveFailedTitle: 'The team member was not saved',
    /** Said when Save is pressed with the form invalid, so nothing happens silently. */
    fixErrors: 'Check the highlighted fields.',

    /** After the service confirmed it. */
    added: 'Team member added.',
    saved: 'Team member updated.',

    loading: 'Loading this team member',
    failedTitle: 'We could not load this team member',
    notFoundTitle: 'This team member is no longer on your team',
    notFoundMessage: 'They may have been removed. Go back to see your team as it is now.',

    discardTitle: 'Discard your changes?',
    discardMessage: 'Your changes to this team member have not been saved.',
    discardKeep: 'Keep editing',
    discardKeepHint: 'Returns to the form',
    discardConfirm: 'Discard',
    discardConfirmHint: 'Leaves without saving',

    /**
     * Section 39's "Disable Team Member", at the foot of the edit form. Done at
     * once, not on Save, and never touching what is typed above it. Disabling
     * asks first; enabling does not, because it only undoes a mark. The words
     * promise nothing the app does not do: a disabled member is marked, and
     * stays on the team.
     */
    statusSection: 'Status',
    statusActiveMessage:
      'Disable someone who is not working with you for now. They stay on your team, and you can enable them again.',
    statusDisabledMessage:
      'This team member is marked as disabled. They stay on your team until you enable them again.',
    /**
     * A status the app does not know. It says neither active nor disabled —
     * the app cannot tell — only what Disable will do.
     */
    statusUnknownMessage:
      'Their current status cannot be shown here. You can still disable them — they stay on your team, marked as disabled.',
    disable: 'Disable member',
    disableHint: 'Asks before marking this team member as disabled',
    enable: 'Enable member',
    enableHint: 'Marks this team member as active again',

    disableTitle: (name: string) => `Disable ${name}?`,
    disableMessage: 'They stay on your team, marked as disabled. You can enable them again.',
    disableCancel: 'Cancel',
    /** Neutral: the member may be in a status the app does not know, not active. */
    disableCancelHint: 'Closes without changing their status',
    disableConfirm: 'Disable',
    disableConfirmHint: 'Marks this team member as disabled',

    /** After the service confirmed it. */
    disabled: 'Team member disabled.',
    enabled: 'Team member enabled.',
    /** Said before the failure's own message; the status did not change. */
    disableFailed: 'The team member was not disabled.',
    enableFailed: 'The team member was not enabled.',
  }),

  /**
   * The vendor's shop images (PROJECT_BIBLE.md section 38, "Upload Shop
   * Images"). Every change is saved as it is made — there is no Save button —
   * so the words say plainly when a photo is still on its way or did not stick.
   */
  shopImages: Object.freeze({
    title: 'Shop images',
    subtitle: 'Photos of your shop, your van or your work. Each change is saved as you make it.',
    back: 'Back to profile',

    /** How many there are against the ceiling. */
    count: (count: number, max: number) => `${count} of ${max} photos`,
    /** Instead of "0 of 6 photos", which reads like a score. */
    emptyCount: (max: number) => `No photos yet. You can add up to ${max}.`,

    loading: 'Loading your shop images',
    failedTitle: 'We could not load your shop images',

    /** Each photograph's spoken name, so "which one" is never a guess. */
    photoSpoken: (position: number, total: number) => `Shop photo ${position} of ${total}`,

    /**
     * The add tile: two ways in, both named, as on a request (section 16) — the
     * choice is made before any camera permission is asked for. Spoken with
     * how many more fit, and starting with the words on the tile.
     */
    takePhoto: 'Take a photo',
    choosePhoto: 'Choose a photo',
    takePhotoSpoken: (remaining: number) =>
      `Take a photo with the camera. ${remaining === 1 ? '1 more photo' : `${remaining} more photos`} can be added.`,
    choosePhotoSpoken: (remaining: number) =>
      `Choose a photo from your library. ${remaining === 1 ? '1 more photo' : `${remaining} more photos`} can be added.`,

    /** A photo's state, as a word beside its glyph — never a tint alone (section 46). */
    uploading: 'Uploading',
    uploadFailed: 'Upload failed',
    /** Uploaded, its save in line behind another's and not sent yet. */
    waiting: 'Waiting to save',
    /** Its save has been sent. */
    saving: 'Saving',
    /** A saved photo whose confirmed removal is in line or sent: still stored until it answers. */
    removing: 'Removing',
    notSaved: 'Not saved',
    tryAgain: 'Try again',
    tryAgainSpoken: (position: number, total: number, state: string) =>
      `Try again, shop photo ${position} of ${total}, ${state}`,
    tryAgainHint: 'Sends this photo again',
    removeSpoken: (position: number, total: number) => `Remove shop photo ${position} of ${total}`,
    removeHint: 'Asks before removing this photo from your shop images',
    /** For a photo that was never saved: taking it off changes nothing stored. */
    discardHint: 'Takes this photo off without saving it',

    removeTitle: 'Remove this photo?',
    removeMessage: 'It will be taken off your shop images.',
    removeCancel: 'Cancel',
    removeCancelHint: 'Keeps this photo',
    removeConfirm: 'Remove',
    removeConfirmHint: 'Removes this photo from your shop images',

    /** After the service confirmed it. */
    added: 'Shop photo saved.',
    removed: 'Shop photo removed.',
    /** Said before the failure's own message; nothing was changed. */
    saveFailed: 'The photo was not saved.',
    removeFailed: 'The photo was not removed.',

    limitReached: (max: number) => `You can add up to ${max} shop photos.`,
    /** A file the image rules refused, when they gave no reason of their own. */
    unusable: 'That photo cannot be used. Please choose another.',
    /** Whatever the reason, the next step is the same: the library is right there. */
    cameraUnavailable:
      'We could not open the camera. You can choose a photo from your library instead.',

    /** A pull that failed over photos that are still on screen (as on the request list). */
    staleTitle: 'Could not refresh',
    staleMessage: 'Your shop images may be out of date.',
    staleRetry: 'Try again',
    staleRetryHint: 'Loads your shop images again',

    /** Leaving while a photo is still on its way, or did not stick. */
    leaveTitle: 'Leave before your photos are saved?',
    /**
     * Exactly what leaving does, in the words on the tiles: those four states
     * are dropped.
     *
     * ⚠️ Unless a save went out and got no answer (`mayBeSaved`): that photo
     * (marked Not saved, or Waiting to save once retried) may be stored
     * already, so for those two states "will not" becomes "may not", and the
     * vendor is told to look again later. Uploading and Upload failed never
     * reached a save, so they stay "will not".
     *
     * A save already sent cannot be called back, but it can still fail — so it
     * is promised to finish and to be reported if it does not, never to be
     * added (the failure is a toast over Profile, with no tile left to retry).
     * A confirmed removal, sent or still waiting its turn, goes ahead whether
     * the vendor stays or not, and is promised exactly that.
     */
    leaveMessage: ({
      alsoSending,
      mayBeSaved,
      alsoRemoving,
    }: {
      alsoSending: boolean;
      mayBeSaved: boolean;
      alsoRemoving: boolean;
    }) =>
      (mayBeSaved
        ? 'Photos marked Uploading or Upload failed will not be added to your shop images, ' +
          'and those marked Waiting to save or Not saved may not be. One whose last save got ' +
          'no answer may have been saved after all; check your shop images later.'
        : 'Photos marked Uploading, Waiting to save, Upload failed or Not saved will not be ' +
          'added to your shop images.') +
      (alsoSending ? ' A photo marked Saving will finish, and you will be told if it is not saved.' : '') +
      (alsoRemoving
        ? ' A photo marked Removing will still be removed, and you will be told if it is not.'
        : ''),
    leaveStay: 'Stay',
    leaveStayHint: 'Returns to your shop images',
    leaveConfirm: 'Leave',
    leaveConfirmHint: 'Leaves without the photos that are not saved',
  }),

  /**
   * Section 38's "Availability" and "Manage Availability": the Profile tab's
   * card and the dashboard's notice. ⚠️ The words promise only what the
   * backend does with the switch — new requests stop; work already accepted
   * carries on — and never that the app hides, refuses or filters anything.
   */
  availability: Object.freeze({
    section: 'Availability',
    acceptingLabel: 'Accepting new requests',
    /** The line under the switch, which changes with it. */
    acceptingOn: 'Customers can choose you and you get new requests.',
    acceptingOff: "You won't get new requests. Work you've accepted isn't affected.",
    /** Spoken with the switch's own on or off, so the sentence under it is heard too. */
    acceptingSpoken: (explanation: string) => `Accepting new requests. ${explanation}`,
    turnOffHint: 'Asks before stopping new requests',
    turnOnHint: 'Turns new requests back on',

    /**
     * Turning new requests off asks first; turning them on does not.
     *
     * ⚠️ The two answers are one word each on purpose. The title asks the
     * question and the message says what it costs, so the answers need say no
     * more — and one word each, they stay side by side on every phone.
     * `ConfirmDialog` no longer cuts a long label off (it stacks the answers
     * when either might not fit its half, about 86dp at 360dp), so longer
     * words would not break the dialog; they would only make it a column for
     * no gain in meaning.
     */
    stopTitle: 'Stop new requests?',
    stopMessage:
      "Customers won't be able to choose you and you won't get new requests until you turn this back on. Work you've accepted isn't affected.",
    stopCancel: 'Cancel',
    stopCancelHint: 'Keeps new requests on',
    stopConfirm: 'Stop',
    stopConfirmHint: 'Stops new requests until you turn them back on',

    /** After the service confirmed it. */
    turnedOn: "You're accepting new requests again.",
    turnedOff: "You've stopped new requests.",
    /** Said before the failure's own message; nothing was changed. */
    turnOnFailed: 'New requests were not turned on.',
    turnOffFailed: 'New requests were not stopped.',

    /** Section 38's "Working Hours", summarised on the same card. */
    hoursLabel: 'Working hours',
    hoursEmpty: 'Not added yet',
    hoursEdit: 'Edit working hours',
    hoursEditHint: 'Opens your working hours to change the days and times',

    /** The dashboard's notice, only while new requests are off. */
    noticeTitle: "You're not accepting new requests.",
    noticeTurnOn: 'Turn on',
    /** Starts with the visible words, so voice control still finds it. */
    noticeTurnOnSpoken: 'Turn on new requests',
    noticeTurnOnHint: 'Starts sending you new requests again',
  }),

  /**
   * The working hours screen and every way a week is written down (section
   * 38's "Working Hours"). Days are named here, by the backend's code; a code
   * this table does not know is shown tidied (`workingHoursPresentation.ts`).
   */
  workingHours: Object.freeze({
    title: 'Working hours',
    subtitle: 'The days and times you usually work. Nothing changes until you save.',
    back: 'Back to profile',

    days: Object.freeze({
      MON: Object.freeze({ short: 'Mon', long: 'Monday' }),
      TUE: Object.freeze({ short: 'Tue', long: 'Tuesday' }),
      WED: Object.freeze({ short: 'Wed', long: 'Wednesday' }),
      THU: Object.freeze({ short: 'Thu', long: 'Thursday' }),
      FRI: Object.freeze({ short: 'Fri', long: 'Friday' }),
      SAT: Object.freeze({ short: 'Sat', long: 'Saturday' }),
      SUN: Object.freeze({ short: 'Sun', long: 'Sunday' }),
    }),
    /** A day the backend sent with no name at all. */
    unknownDay: 'Day',

    closed: 'Closed',
    /** An open day the backend sent without its times: open is all that can be said. */
    open: 'Open',
    openSpoken: 'open',
    /** Drawn with a dash; spoken with "to", which a screen reader says as a word. */
    hours: (opens: string, closes: string) => `${opens} – ${closes}`,
    hoursSpoken: (opens: string, closes: string) => `${opens} to ${closes}`,
    dayRange: (first: string, last: string) => `${first}–${last}`,
    dayRangeSpoken: (first: string, last: string) => `${first} to ${last}`,
    /** One line of the Profile tab's summary: "Monday to Saturday, 9:00 AM to 7:00 PM". */
    summarySpoken: (days: string, hours: string) => `${days}, ${hours}`,
    closedSpoken: 'closed',

    /** One day's row on the screen: one stop, its switch, its hours. */
    dayOpenSpoken: (day: string, hours: string) => `${day}, open, ${hours}`,
    dayClosedSpoken: (day: string) => `${day}, closed`,
    dayCloseHint: (day: string) => `Marks ${day} as closed`,
    dayOpenHint: (day: string) => `Marks ${day} as open`,

    opensLabel: 'Opens',
    closesLabel: 'Closes',
    opensSpoken: (day: string, time: string) => `${day} opening time, ${time}`,
    closesSpoken: (day: string, time: string) => `${day} closing time, ${time}`,
    timeHint: 'Opens a list of times to choose from',

    /** The list of times, in its own dialog. */
    opensTitle: (day: string) => `${day} opening time`,
    closesTitle: (day: string) => `${day} closing time`,
    timesLabel: 'Times',
    chooseCancel: 'Cancel',
    chooseCancelHint: 'Closes the list without changing the time',

    closesBeforeOpens: 'Closing time must be after opening time.',

    /** One press instead of ten choices, for the usual case of a working week alike. */
    copyMonday: 'Copy Monday to all weekdays',
    copyMondayHint: 'Gives Tuesday to Friday the same hours as Monday',
    copiedMonday: "Tuesday to Friday now have Monday's hours.",

    save: 'Save changes',
    saving: 'Saving…',
    saveHint: 'Saves your working hours',
    saveFailedTitle: 'Your working hours were not saved',
    /** Said when Save is pressed with a day wrong, so nothing happens silently. */
    fixErrors: 'Check the highlighted days.',
    /** After the service confirmed it. */
    saved: 'Working hours saved.',

    discardTitle: 'Discard your changes?',
    discardMessage: 'Your changes to your working hours have not been saved.',
    discardKeep: 'Keep editing',
    discardKeepHint: 'Returns to your working hours',
    discardConfirm: 'Discard',
    discardConfirmHint: 'Leaves without saving',
  }),

  profile: Object.freeze({
    title: 'Profile',
    businessSection: 'Business',
    descriptionLabel: 'About',
    categoriesLabel: 'Services',
    areaLabel: 'Service area',
    notProvided: 'Not added yet',
    categoriesFailed: 'Could not load service names',
    contactSection: 'Contact',
    ownerLabel: 'Owner',
    phoneLabel: 'Phone',
    emailLabel: 'Email',
    edit: 'Edit business profile',
    editHint: 'Opens the business profile form',
    /** The way to section 41's reviews (Phase 3E-6). */
    reviews: 'Customer reviews',
    reviewsHint: 'Opens the reviews customers wrote about your work',
    /**
     * The same way in once the rating has been read (Phase 3E-15): the button's
     * words first, so voice control still finds it by them, then the figure —
     * "Customer reviews. Rating 4.3 out of 5, based on 4 reviews."
     */
    reviewsWithRating: (rating: string) => `Customer reviews. ${rating}`,
    /** The way to section 42's basic report. */
    reports: 'Reports',
    reportsHint: 'Opens your request and rating figures for today, this week or this month',
    /** The way to section 39's team (Phase 3E-7) — the Team tab. */
    team: 'Manage team',
    teamHint: 'Opens your team',
    /**
     * Section 38's shop images as the Profile tab shows them, and the way to
     * the screen that changes them.
     */
    shopImagesSection: 'Shop images',
    shopImagesEmpty: 'No shop images yet',
    shopImages: 'Manage shop images',
    shopImagesHint: 'Opens your shop images to add or remove photos',
    logout: 'Log out',
    logoutHint: 'Asks before signing you out',
    logoutFailedTitle: 'We could not sign you out',
    logoutConfirmTitle: 'Log out?',
    logoutConfirmMessage: 'Your business profile stays saved for when you sign back in.',
    logoutCancel: 'Cancel',
    logoutCancelHint: 'Stays signed in',
    logoutConfirm: 'Log out',
    logoutConfirmHint: 'Signs you out of Fixora',
  }),
});

export const VENDOR_COPY = localized({
  en: VENDOR_COPY_EN,
  hi: VENDOR_COPY_HI,
  gu: VENDOR_COPY_GU,
});
