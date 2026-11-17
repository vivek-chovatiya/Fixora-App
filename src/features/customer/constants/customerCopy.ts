/**
 * Customer copy
 *
 * Every string the customer application shows, in one place.
 *
 * Kept out of the components for the same reason the auth flow keeps its own:
 * copy is the part most likely to be revised by someone who does not read JSX,
 * and a sentence split across two screens is a sentence that drifts. It is also
 * the seam multi-language plugs into later — one file to translate rather than
 * a search across every component.
 *
 * ⚠️ Nothing here may name a service category. Categories are backend data
 * (PROJECT_BIBLE.md section 11), so a heading that mentioned one would hardcode
 * the catalogue into the app by the back door.
 */

import { RATING_COPY } from '@/shared/presentation/rating';

export const CUSTOMER_COPY = Object.freeze({
  home: Object.freeze({
    /**
     * Three greetings rather than one.
     *
     * A home screen opened at seven in the morning and at eleven at night should
     * not say the same thing; it is the cheapest signal that the screen is aware
     * of the person in front of it rather than merely rendered for them.
     */
    greetingMorning: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',

    /** Used until the session's name is known, which is a moment at most. */
    greetingFallbackName: 'there',

    /**
     * The question PROJECT_BIBLE.md section 10 requires this screen to ask
     * immediately. It is the heading, not a caption, because it is the reason
     * the screen exists.
     */
    prompt: 'What service do you need?',
    promptSupport: 'Pick a category and we will line up a professional near you.',

    primaryAction: 'Request a Service',
    primaryActionHint: 'Opens the list of service categories',

    categoriesTitle: 'Service categories',
    categoriesAction: 'See all',
    categoriesActionHint: 'Opens the full list of service categories',
    categoriesEmptyTitle: 'No services listed yet',
    categoriesEmptyMessage:
      'Services appear here as soon as they are available in your area.',
    /** Spoken for the categories section while its tiles are placeholders. */
    categoriesLoadingLabel: 'Loading service categories',

    recentTitle: 'Recent requests',
    /** Spoken for the recent requests section while its cards are placeholders. */
    recentLoadingLabel: 'Loading recent requests',

    /** PROJECT_BIBLE.md section 48 fixes this sentence and its action. */
    recentEmptyTitle: "You don't have any service requests yet.",
    recentEmptyMessage: 'Your requests will show up here so you can follow them at a glance.',

    /** Names the screen for assistive technology, which the tab label alone does not. */
    screenLabel: 'Home',

    /**
     * A pull that failed while the sections still show what they had — the
     * vendor lists' notice, worded for a page that holds two kinds of thing.
     */
    staleTitle: 'Could not refresh',
    staleMessage: 'What you see here may be out of date.',
    staleRetry: 'Try again',
    staleRetryHint: 'Loads your services and requests again',

    /**
     * The unfinished request waiting to be picked back up.
     *
     * Written as an invitation rather than a warning: nothing has gone wrong,
     * and a customer who was interrupted does not need telling off. It names the
     * service so they can see at a glance which request it is, and falls back to
     * the neutral wording when the catalogue has not answered.
     */
    resumeTitle: 'Continue your request',
    resumeMessage: 'Pick up where you left off.',
    resumeAction: 'Continue',
    resumeHint: 'Reopens the request you started',
    resumeFallbackService: 'a service',
  }),

  categories: Object.freeze({
    /**
     * "All", because Home already showed some. The word is the difference
     * between this screen and the section it was reached from.
     */
    title: 'All categories',
    subtitle: 'Choose the kind of help you need and we will take it from there.',

    /** Named per item, so the hint says what tapping this one does. */
    itemHint: 'Shows the services in this category',

    emptyTitle: 'No services listed yet',
    emptyMessage:
      'Services appear here as soon as they are available in your area. Please check back soon.',

    back: 'Back',
    backHint: 'Returns to the previous screen',

    /** Spoken while the grid is still a set of placeholders. */
    loadingLabel: 'Loading categories',

    /** A pull that failed while the grid still shows what it had. */
    staleTitle: 'Could not refresh',
    staleMessage: 'These categories may be out of date.',
    staleRetry: 'Try again',
    staleRetryHint: 'Loads the categories again',
  }),

  subCategories: Object.freeze({
    /**
     * Shown until the category's own name is known, and after it if the name
     * never arrives. The instruction is the same either way, which is why the
     * heading can carry the category without the screen losing its meaning when
     * it cannot.
     */
    fallbackTitle: 'Choose a service',
    subtitle: 'Pick the job you need doing and we will take the details next.',

    itemHint: 'Starts a request for this service',

    emptyTitle: 'Nothing listed here yet',
    emptyMessage:
      'This category has no services available right now. Try another one, or check back soon.',

    back: 'Back',
    /**
     * Not "to the categories": a category tile on Home opens this screen
     * directly, and Back then goes home rather than to the catalogue.
     */
    backHint: 'Returns to the previous screen',

    /** Spoken while the list is still a set of placeholders. */
    loadingLabel: 'Loading services',
  }),

  createRequest: Object.freeze({
    title: 'Request details',
    subtitle: 'Tell us what needs doing. We will pass it on to a professional.',

    back: 'Back',
    backHint: 'Returns to the list of services',

    /**
     * Names the service the request is for.
     *
     * The category and the service itself are both shown, because "Fan repair"
     * on its own does not say whether an electrician or a handyman is coming.
     */
    serviceTitle: 'Service',
    /**
     * Stands in until the catalogue answers, and stays if it never does.
     *
     * Deliberately says nothing about which service it is. The screen was handed
     * two identifiers, not a name, and a guess here would be the app inventing
     * the catalogue it spent three screens refusing to hardcode.
     */
    serviceFallback: 'Selected service',
    serviceUnavailable:
      'We could not load the service name, but your request will still reach the right people.',

    /**
     * Said when an unfinished request for another service is waiting, because
     * there is one draft and Continue here replaces it. The truth, plainly, and
     * no warning colour: nothing has gone wrong, and nothing happens unless they
     * press Continue. `{service}` is that request's category — its service, or
     * `otherDraftSameCategory`, when it is in this form's own category, so it
     * cannot read as this request — or `home.resumeFallbackService` when the
     * catalogue cannot name it.
     *
     * "Only": while that request exists, what is entered here and left without
     * Continue is not kept, and the sentence says so rather than implying an
     * autosave that does not happen (found in review).
     */
    otherDraftNotice: 'You have an unfinished request for {service}.',
    /**
     * `{service}` for a request in this form's own category whose service cannot
     * be named (its read failed, or it is no longer listed). Never the bare
     * category: on an Electrician form, "for Electrician" reads as this request.
     */
    otherDraftSameCategory: 'another {category} service',
    otherDraftConsequence:
      'This request is kept only when you press Continue, and it will then replace that one.',

    priorityTitle: 'How urgent is it?',
    prioritySupport: 'This helps us decide how quickly to find someone.',

    dateTitle: 'Preferred date',
    timeTitle: 'Preferred time',
    /**
     * Both are preferences, and section 14 makes both optional.
     *
     * ⚠️ Says what happens to the answer and nothing more. It used to promise
     * "we will … confirm before anyone visits", and the app has no visit
     * confirmation of any kind (21/10/2026). The answer travels with the
     * request; "not a booking" is the expectation that is true.
     */
    scheduleSupport: 'Optional. Sent with your request as a preference, not a booking.',
    anyDate: 'No preference',
    anyTime: 'No preference',
    today: 'Today',
    tomorrow: 'Tomorrow',
    dateHint: 'Sets the day you would prefer',
    timeHint: 'Sets the time you would prefer',

    photosTitle: 'Photos',
    /**
     * Why a photo helps, without a channel behind it. It used to say a picture
     * "saves everyone a phone call", which promised a call the app has no way
     * to make or receive (21/10/2026).
     */
    photosSupport: 'Optional. A photo often shows the problem better than words.',
    photosCamera: 'Camera',
    photosGallery: 'Gallery',
    photosCameraHint: 'Opens the camera to take a photo of the problem',
    photosGalleryHint: 'Opens your photo library',
    photoRemove: 'Remove photo',
    photoRetry: 'Retry upload',
    photoUploading: 'Uploading',
    photoFailed: 'Upload failed',
    photoUploaded: 'Uploaded',
    /** `{count}` is filled with AppConfig.image.maxUploadsPerRequest. */
    photosLimitReached: 'You can add up to {count} photos.',
    /**
     * Said when the camera cannot be opened, for any reason the app is allowed
     * to know about. It does not distinguish a refusal from a device without a
     * camera, because the customer's next step is the same either way.
     */
    cameraUnavailable:
      'We could not open the camera. You can pick a photo from your library instead.',
    photosBusy: 'Your photos are still uploading.',
    photosUnresolved:
      'Some photos did not upload. Retry them or remove them before you submit.',

    notesTitle: 'Notes',
    notesLabel: 'Anything else we should know?',
    notesPlaceholder: 'The fan makes a noise and stops after ten minutes.',
    notesSupport: 'Optional.',

    /**
     * Not "Submit". PROJECT_BIBLE.md section 13 puts vendor selection between
     * these details and submission, so a button here that said Submit would be
     * promising to send a request it is about to ask another question about.
     */
    submit: 'Continue',
    submitHint: 'Goes on to choosing a professional',

    /** Names the screen for assistive technology while the service loads. */
    loadingLabel: 'Loading service details',
  }),

  /**
   * Where the work is to be done (PROJECT_BIBLE.md section 18).
   *
   * ⚠️ The tone is the point here. An address box is the most personal thing the
   * app asks for, and the two ways of answering it are not equal — typing is
   * always available and always sufficient, and sharing a location is a
   * shortcut. Every string below is written so that nothing reads as a demand
   * and nothing implies the request cannot proceed without the device.
   */
  serviceAddress: Object.freeze({
    title: 'Where should we come?',
    subtitle: 'The professional needs an address to find you.',

    back: 'Back',
    backHint: 'Returns to the request details',

    /** The search box. Deliberately not "Search" — this is where you say where. */
    searchLabel: 'Service address',
    searchPlaceholder: 'Street, area or landmark',
    searchHint: 'Type to see matching addresses',

    /**
     * The shortcut, worded as an offer.
     *
     * Not "Allow location" and not "Enable GPS": the customer is asking the app
     * to fill the box in, and what that costs them is the next thing they will
     * be shown by the system anyway.
     */
    useCurrentLocation: 'Use my current location',
    useCurrentLocationHint: 'Finds your address from your device location',
    locating: 'Finding your location',

    /**
     * The other shortcut, offered only to a customer who has saved an address.
     * Worded like its neighbour: it fills the box in, and the customer can still
     * change what it put there.
     */
    useSaved: 'Use a saved address',
    useSavedHint: 'Choose one of your saved addresses to fill this in',

    suggestionsLabel: 'Matching addresses',
    /** Announced with each row so a reader knows what tapping it does. */
    suggestionHint: 'Selects this as your service address',

    /** Before anything has been typed. An invitation, not an error. */
    emptyTitle: 'Start typing an address',
    emptyMessage: 'Or use your current location, if you would rather not type it.',

    noResultsTitle: 'No matching addresses',
    /**
     * ⚠️ The most important sentence on this screen.
     *
     * A gazetteer that has never heard of somebody's street must not be the
     * thing that stops them booking a plumber. This says, in the customer's
     * words, that what they typed is enough.
     */
    noResultsMessage: 'We could not find that one. You can use exactly what you typed.',
    useTyped: 'Use what I typed',
    useTypedHint: 'Sets your service address to the text you entered',

    searchErrorFallback: 'Address search is unavailable right now. You can still type your address.',

    /** The chosen address, once there is one. */
    selectedLabel: 'Service address',
    change: 'Change',
    changeHint: 'Clears this address so you can choose another',

    /**
     * Said once Continue has been pressed with nothing chosen, never before. A
     * screen that complains the moment it opens is a screen that starts by
     * telling somebody off.
     */
    required: 'Add a service address to continue.',
    tooShort: 'That looks a little short. Add enough for someone to find you.',

    submit: 'Continue',
    submitHint: 'Saves this address and moves on to choosing a professional',
  }),

  /**
   * Picking one of the customer's saved addresses for the request being raised.
   *
   * ⚠️ It fills the address in and changes nothing else. The wording says the
   * customer can still change it, because they can — the Service Address screen
   * they return to holds it as an answer they may edit, not one already sent.
   */
  chooseSavedAddress: Object.freeze({
    title: 'Choose a saved address',
    subtitle: 'It fills in your service address. You can still change it before you continue.',

    back: 'Back',
    backHint: 'Returns to the service address',

    /** Announced with each address so a reader knows what choosing it does. */
    optionHint: 'Uses this as your service address',

    loadingLabel: 'Loading your saved addresses',

    failedTitle: 'We could not load your saved addresses',
    /** Only reachable if every address was removed elsewhere since the last screen. */
    emptyTitle: 'No saved addresses',
    emptyMessage: 'Go back to type your address, or use your current location.',
  }),

  /**
   * Location permission, from the request flow's point of view.
   *
   * ⚠️ Separate from the onboarding copy on purpose, and phrased differently.
   * Onboarding explains a capability before anything needs it; here somebody has
   * pressed a button and wants an outcome, so these are short and every one of
   * them ends in the same place — you can type it instead.
   */
  location: Object.freeze({
    /**
     * Denied and blocked say the same thing, deliberately.
     *
     * One means "not this time" and one means "the system will not ask again",
     * and the useful next sentence for a customer who wants a plumber is
     * identical. The difference is expressed by whether a Settings button
     * appears, not by two paragraphs about permission states.
     */
    denied: 'Location access is not available. You can enter your service address instead.',
    openSettings: 'Open Settings',
    openSettingsHint: 'Opens this app in system settings, where location access can be changed',

    /** The fix failed, the radio is off, or there is no geolocation at all. */
    unavailable: 'We could not get your location. Please type your address instead.',
    /** A fix arrived but nothing could be made of it. */
    unresolved: 'We could not work out the address for your location. Please type it instead.',

    /**
     * Shown with the resolved address, before it is accepted.
     *
     * ⚠️ Section 18's rule and the reason this screen does not simply fill the
     * box in and move on: a coordinate turned into a street is a guess, and the
     * customer is the only one who can say whether it is their street.
     */
    confirmPrompt: 'Is this right? You can edit it before continuing.',
  }),

  preferredVendor: Object.freeze({
    title: 'Choose a professional',
    /**
     * States both outcomes in one sentence, because PROJECT_BIBLE.md section 19
     * says the customer must never be unsure which one they are in. It promises
     * that available professionals are told about the job — which is section
     * 18A's open dispatch — and nothing about how fast anyone replies.
     */
    subtitle:
      'Pick someone specific, or let us tell available professionals about your request.',

    back: 'Back',
    backHint: 'Returns to the service address',

    /** Named per card, so the hint says what choosing this one does. */
    vendorHint: 'Sends your request to this professional',

    /** Spoken as part of a rating, never drawn on its own. */
    ratingUnit: 'stars',
    reviewsUnit: 'reviews',

    /**
     * Section 18A.5 requires this to read as a first-class choice rather than a
     * way out of choosing, so it is written as what it does, not as a refusal.
     */
    noPreferenceTitle: 'No preference',
    noPreferenceMessage: 'We will tell available professionals about your request.',
    noPreferenceHint: 'Sends your request to any available professional',

    /**
     * Nothing is selected to begin with, and section 19 is why: the customer
     * must reach the end of this step knowing which of the two they picked,
     * which cannot be true of a choice that was made for them.
     */
    chooseFirst: 'Choose a professional, or select no preference.',

    emptyTitle: 'No professionals listed right now',
    /**
     * Deliberately not an apology, and deliberately not a dead end. Section
     * 18A.4 requires an empty list to leave submission open, so this says what
     * the customer can still do rather than what the app could not find.
     */
    emptyMessage:
      'We will tell professionals about your request as soon as they are available. Choose no preference to carry on.',

    /**
     * Shown beside the failure. Section 18A.4 requires a failed vendor list to
     * leave submission open too, so the customer is told the list is what
     * failed — not their request.
     */
    errorFallback: 'You can still carry on with no preference.',

    /**
     * Said when a resumed or restored draft named a professional the latest
     * list no longer has, and the app has taken them off it (Phase 3D-12). One
     * calm sentence: nothing is wrong with the request, nothing is blamed on
     * anybody, and it names both ways on — the two answers section 19 needs.
     * It says "not available for this service now" and nothing about why; the
     * app is not told why, and a reason guessed would be a claim about a
     * person.
     */
    vendorUnavailable:
      'The professional you chose earlier is not available for this service now, so you can choose another or continue with no preference.',

    /**
     * Not "Submit". PROJECT_BIBLE.md section 19 puts a summary between this
     * choice and sending, so a button here promising to send would be promising
     * something the next screen still asks about.
     */
    submit: 'Continue',
    submitHint: 'Goes on to check your request',

    /** Spoken while the list is still a set of placeholders. */
    loadingLabel: 'Loading professionals',
  }),

  confirmation: Object.freeze({
    title: 'Check your request',
    subtitle: 'One last look before we send it. You can go back and change anything.',

    back: 'Back',
    backHint: 'Returns to choosing a professional',

    /*
      Group headings.

      The summary is read, not scanned for one fact, and eight unbroken rows is
      a paragraph. Grouped, a customer checking one thing — did I say Tuesday? —
      knows which third of the card to look at.
    */
    sectionService: 'Service',
    sectionDetails: 'Request details',
    sectionExtras: 'Additional information',
    sectionLocation: 'Service location',
    sectionVendor: 'Professional preference',

    /**
     * The word on every group's edit control.
     *
     * One word, repeated, because each one sits under a heading that has already
     * said what it edits. The screen-reader label below is the full sentence,
     * since a screen reader can reach the button without the heading.
     */
    edit: 'Edit',
    editDetails: 'Edit request details',
    editDetailsHint: 'Returns to urgency and preferred time',
    editExtras: 'Edit notes and photos',
    editExtrasHint: 'Returns to notes and photos',
    editVendor: 'Change professional',
    editVendorHint: 'Returns to choosing a professional',
    editAddress: 'Edit service address',
    editAddressHint: 'Returns to choosing where the work is',

    serviceLabel: 'Service',
    categoryLabel: 'Category',
    /** Stands in when the catalogue has not answered. Never guesses a name. */
    serviceFallback: 'Selected service',
    priorityLabel: 'Urgency',
    dateLabel: 'Preferred date',
    timeLabel: 'Preferred time',
    photosLabel: 'Photos',
    /** Counted in words, because "Photos 3" reads as a heading and a stray number. */
    photoCountOne: '1 photo attached',
    photoCountMany: 'photos attached',
    /** What a thumbnail is, for a reader who cannot see it. */
    photoAlt: 'Photo attached to this request',
    /** Follows a count: "2 photos attached, 1 could not be shown". */
    photoUnavailable: 'could not be shown',
    notesLabel: 'Notes',
    /** Said when a group has nothing in it, rather than drawing an empty card. */
    extrasEmpty: 'No notes or photos added.',

    /**
     * Screen-reader wording for the address block.
     *
     * ⚠️ The address itself is what is read out, never the coordinates behind
     * it. A confirmation screen that announced 12.9716 would be announcing its
     * own working, and to a customer checking their address it would be noise
     * between them and the answer.
     */
    addressLabel: 'Service address',

    vendorLabel: 'Professional',
    /**
     * PROJECT_BIBLE.md section 19 fixes the meaning of this row: a customer must
     * never reach Submit unsure whether they chose someone. Open dispatch is
     * therefore stated in words rather than left as a blank that could be read
     * either way.
     */
    vendorOpen: 'Any available professional',
    /**
     * The identifier is held but the name could not be resolved — the list has
     * not loaded yet, or its read failed. The request is still directed at
     * them, so this says the choice stands without inventing a name. A
     * professional the loaded list no longer has is never shown here: they are
     * taken off the draft and the customer is sent back to choose (3D-12).
     */
    vendorUnknown: 'The professional you chose',
    /**
     * Beside a failed read of the professionals while one is chosen: Submit
     * stays locked, because a professional nobody could check is never sent
     * (3D-12). Says what is needed and both ways on — try the check again, or
     * change the choice (no preference needs no check).
     */
    vendorCheckFailed:
      'We need to check that the professional you chose is still available before sending. Try again, or change professional.',

    /**
     * The reassurance beside Submit, and one the app keeps: a request can be
     * cancelled from its details until a professional accepts it
     * (`isCancellableState`). It used to say "We will confirm before anyone
     * visits", and there is no visit confirmation anywhere (21/10/2026).
     */
    assurance: 'You can cancel it until a professional accepts it.',

    submit: 'Submit Request',
    submitHint: 'Sends your request',
  }),

  /**
   * The moment after a request goes out (PROJECT_BIBLE.md section 19).
   *
   * ⚠️ Nothing here claims anybody has been told. The backend owns dispatch, and
   * this application has no way of knowing whether a notification was delivered
   * — so the wording says what Fixora did with the request, never what a
   * professional has seen. "Sent to" is about where it was directed, not about
   * anyone's phone lighting up.
   */
  requestSubmitted: Object.freeze({
    /**
     * Past tense and plain.
     *
     * Not "Thank you" — the customer has not done Fixora a favour, they have
     * asked for a plumber — and not "Success!", which is the vocabulary of a
     * dialog rather than of somebody being told their problem is in hand.
     */
    title: 'Request sent',
    /**
     * Names the one channel the app has: the notifications inbox behind the
     * bell on Home (section 57), where "Request accepted" arrives. It used to
     * say "You will hear from us", which named no channel at all (21/10/2026).
     */
    subtitle: "We'll let you know in Notifications when a professional picks it up.",

    /** Spoken when the screen opens, so it does not arrive silently. */
    announcement: 'Your request has been sent.',

    referenceLabel: 'Reference',
    /**
     * Said under the reference, because a number with no purpose is noise. It
     * names what the number is and where it turns up again — every request card
     * carries it. It used to say "Quote this if you get in touch", and the app
     * has no way to get in touch (21/10/2026).
     */
    referenceHint: 'Your reference for this request. It is also shown in My Requests.',
    copy: 'Copy',
    copied: 'Copied',
    copyHint: 'Copies the reference to the clipboard',
    copyFailed: 'We could not copy it. You can write it down instead.',

    serviceLabel: 'Service',
    addressLabel: 'Going to',

    /**
     * The two dispatch outcomes, worded to match what actually happened.
     *
     * ⚠️ Neither says a vendor has been notified. Section 18A puts dispatch on
     * the backend, and the app is in no position to assert that a message
     * arrived anywhere — so the directed line says where the request was
     * pointed, and the open line says who it is available to.
     */
    dispatchDirected: 'Sent to',
    dispatchOpen: 'Open to available professionals',
    /** The chosen professional could not be named. The direction still stands. */
    dispatchDirectedUnknown: 'Sent to the professional you chose',

    /**
     * What happens next, in one line. No promises about timing, and none about
     * a channel the app does not have: it used to say "We will confirm the
     * visit with you before anyone comes round", and nothing confirms a visit
     * (21/10/2026). What is true is where the request can be followed, and
     * that it can be cancelled there until it is accepted.
     */
    nextTitle: 'What happens next',
    nextMessage: 'You can follow it in My Requests, and cancel it there until a professional accepts it.',

    /**
     * Only offered when there is a reference to open. A request the backend did
     * not name is a request this app has no way to look up.
     */
    viewRequest: 'View Request',
    viewRequestHint: 'Opens the details of this request',

    home: 'Back to home',
    homeHint: 'Returns to the home screen',
  }),

  /**
   * One request, read back after it was sent (PROJECT_BIBLE.md section 20).
   *
   * ⚠️ Most of what this screen says, the confirmation block above already says,
   * and the screen reuses those strings rather than repeating them — "Urgency",
   * "Service location" and "Any available professional" mean the same thing
   * before a request is sent and after. What is here is only what is new: the
   * words for a request that exists, and for one that could not be found.
   */
  requestDetails: Object.freeze({
    title: 'Your request',

    back: 'Back',
    backHint: 'Returns to the previous screen',

    /** Spoken once while the page is a set of placeholders. */
    loadingLabel: 'Loading your request',

    /** The backend's status, in the presentation table's words. Never a promise. */
    statusLabel: 'Current status',
    /** When it was raised, in the same relative wording the request cards use. */
    sentLabel: 'Sent',

    /**
     * "Professional" rather than the summary's "Professional preference",
     * because this group can hold two facts — who was asked for, and who has the
     * job.
     */
    sectionVendor: 'Professional',
    /**
     * ⚠️ Two labels, never one. "Requested" is what the customer said; "Assigned"
     * is what the backend says has happened, and it is drawn only when the
     * record names somebody. A directed request that nobody has accepted shows
     * the first and not the second — section 20's line between waiting on
     * someone and being looked after by them.
     */
    requestedLabel: 'Requested',
    assignedLabel: 'Assigned',

    /**
     * Not an error, and not worded as one. A reference that matches nothing is
     * an answer — usually an old link — and the useful next step is the list of
     * requests that do exist, not a retry of the one that does not.
     */
    notFoundTitle: 'We could not find this request',
    notFoundMessage:
      'The reference may be out of date. Your recent requests are on the home screen.',

    home: 'Back to home',
    homeHint: 'Returns to the home screen',
  }),

  /**
   * Cancelling a request nobody has accepted yet, from its details (owner
   * decision, 21/10/2026; section 21 names `CANCELLED` and section 23 a
   * Cancelled filter).
   *
   * The page's button and the dialog's confirming button say the same words on
   * purpose: the dialog asks about the thing just pressed. "Keep request" rather
   * than "Cancel" for the way out, because a dialog about cancelling whose safe
   * answer is also called Cancel would leave the customer guessing which one
   * cancels.
   *
   * ⚠️ `refused` is the race the rule exists for — a professional accepted it
   * between the customer seeing it and pressing — and it is information, not an
   * error (section 49.1). It says "here" because the app has no other way to
   * cancel it, and claims nothing about a channel it does not have.
   */
  cancelRequest: Object.freeze({
    action: 'Cancel request',
    actionHint: 'Asks before cancelling this request',

    confirmTitle: 'Cancel this request?',
    confirmMessage: "Professionals will no longer see it. This can't be undone.",
    keep: 'Keep request',
    keepHint: 'Closes this and leaves your request as it is',
    confirm: 'Cancel request',
    confirmHint: 'Cancels this request',

    cancelled: 'Request cancelled.',
    refused: "A professional has already accepted this request, so it can't be cancelled here.",
    /** Said before the failure's own message, so the toast says what did not happen. */
    failed: 'Your request was not cancelled.',
  }),

  /**
   * The payment on a completed request, as the professional recorded it
   * (PROJECT_BIBLE.md sections 36 and 37).
   *
   * ⚠️ Recorded, never processed. Nothing here says Fixora took, received or
   * confirmed the money; the last line says whose record it is. The status
   * words ("Paid", "Not paid yet") are the shared `presentation/payment`
   * table's, so the professional and the customer read the same ones.
   */
  payment: Object.freeze({
    section: 'Payment',
    amountLabel: 'Final amount',
    statusLabel: 'Payment status',
    recorded: 'Recorded by your professional. Fixora does not process payments.',
  }),

  /**
   * What a request's status means to the customer (PROJECT_BIBLE.md sections 20
   * and 21). Presented through `requestStatus.ts`, never read directly.
   *
   * ⚠️ These describe derived stages, not backend statuses — "Searching" and
   * "Awaiting response" are the same backend status for two dispatch modes.
   *
   * ⚠️ The wording has rules, because every sentence here is a claim about
   * something the app cannot see. Nothing says a professional was notified,
   * has accepted, is on the way or will arrive by a time. "Assigned" is the
   * first state that names anyone as having the job, and it is only reached
   * when the backend says so.
   *
   * `label` is short enough for a badge on a card; `title` heads the request;
   * `description` is one sentence of what the state means.
   */
  requestStatus: Object.freeze({
    submitted: Object.freeze({
      label: 'Submitted',
      title: 'Request submitted',
      description: 'Your request has been received.',
    }),
    searching: Object.freeze({
      label: 'Searching',
      title: 'Searching for a professional',
      description: 'We are looking for an available professional for your request.',
    }),
    awaiting_vendor: Object.freeze({
      label: 'Awaiting response',
      title: 'Awaiting professional response',
      description: 'Your request is waiting for the professional you chose to respond.',
    }),
    /**
     * The wait, when the dispatch mode is not known — a card drawn from a
     * summary. True of both kinds of wait, so it cannot mislead either.
     */
    awaiting_professional: Object.freeze({
      label: 'Awaiting professional',
      title: 'Awaiting a professional',
      description: 'Your request is waiting for a professional to take it on.',
    }),
    assigned: Object.freeze({
      label: 'Assigned',
      title: 'Professional assigned',
      description: 'A professional has been assigned to your request.',
    }),
    in_progress: Object.freeze({
      label: 'In progress',
      title: 'Service in progress',
      description: 'Your service is in progress.',
    }),
    completed: Object.freeze({
      label: 'Completed',
      title: 'Service completed',
      description: 'This request has been completed.',
    }),
    cancelled: Object.freeze({
      label: 'Cancelled',
      title: 'Request cancelled',
      description: 'This request has been cancelled.',
    }),
    /** Deliberately says nothing about who declined or why. */
    rejected: Object.freeze({
      label: 'Not accepted',
      title: 'Request not accepted',
      description: 'This request was not accepted.',
    }),
    on_hold: Object.freeze({
      label: 'On hold',
      title: 'Request on hold',
      description: 'This request is on hold for now.',
    }),
    /**
     * A status the app does not recognise. Conservative on purpose: it neither
     * guesses what the new state means nor hides that there is one.
     */
    unknown: Object.freeze({
      label: 'Status unavailable',
      title: 'Request status unavailable',
      description: 'We are unable to show the latest status right now.',
    }),

    /** Screen-reader fragments for the progress summary. */
    summaryPrefix: 'Request status',
    stepComplete: 'is complete',
    stepCurrent: 'is current',
  }),

  /**
   * Every request the customer has sent (PROJECT_BIBLE.md section 23).
   *
   * ⚠️ The filters are section 23's four, named exactly as it names them. What
   * each one includes is the backend's answer, so nothing here says which
   * statuses a filter covers — only what the customer sees when one is empty.
   */
  myRequests: Object.freeze({
    /** Section 23 names the screen. */
    title: 'My Requests',
    subtitle: 'Every request you have sent, newest first.',

    loadingLabel: 'Loading your requests',
    loadingMoreLabel: 'Loading more requests',

    filtersLabel: 'Show requests',
    filterAll: 'All',
    filterActive: 'Active',
    filterCompleted: 'Completed',
    filterCancelled: 'Cancelled',
    filterHint: 'Shows only these requests',

    /**
     * Asked for, never automatic. Section 23 requires pagination but not how the
     * next page is reached, so it is a button: nothing loads that the customer
     * did not ask for, and a screen reader can reach it like anything else.
     */
    showMore: 'Show more requests',
    showMoreHint: 'Loads the next requests in the list',

    /**
     * No requests at all: section 48's sentence and its action, the same words
     * Home uses. A filter that matches nothing is not the same situation — the
     * customer has requests, just none of this kind — so it says that instead,
     * and offers nothing, because there is nothing to fix.
     */
    emptyActiveTitle: 'No active requests',
    emptyActiveMessage: 'Requests that are still under way will show up here.',
    emptyCompletedTitle: 'No completed requests',
    emptyCompletedMessage: 'Requests that have been completed will show up here.',
    emptyCancelledTitle: 'No cancelled requests',
    emptyCancelledMessage: 'Requests that have been cancelled will show up here.',

    /** Said above the retry when the next page, rather than the list, failed. */
    moreFailedTitle: 'We could not load more requests',
  }),

  /**
   * A customer's review of a finished request (PROJECT_BIBLE.md section 24).
   *
   * ⚠️ Nothing here claims more than the review contract does. A submitted
   * review is "sent" and "saved with this request"; it is never "published",
   * "shared with the professional" or "added to their rating" — none of that is
   * something the app can see happen.
   */
  review: Object.freeze({
    /** Section 24 names the screen. */
    title: 'Rate Your Experience',
    subtitle: 'Tell us how the work on this request went.',

    back: 'Back',
    backHint: 'Returns to your request',

    loadingLabel: 'Loading the review for this request',

    /** Which request the review is about, so nobody rates the wrong job. */
    requestLabel: 'Request',
    vendorPrefix: 'By',

    ratingTitle: 'Your rating',
    ratingSupport: 'Choose from 1 to 5 stars.',
    /*
      The stars' own words, shared with the vendor's reviews since Phase 3E-6
      (`shared/presentation/rating.ts`), so a rating reads the same to both.
      Kept under these names so the review screens and their tests are
      untouched.
    */
    ratingLabel: RATING_COPY.label,
    ratingValue: RATING_COPY.value,
    ratingNone: RATING_COPY.none,
    ratingHint: RATING_COPY.hint,
    ratingRequired: 'Choose a rating from 1 to 5 stars.',

    commentTitle: 'Comment',
    commentLabel: 'Anything you would like to add?',
    commentPlaceholder: 'The work was done well and the problem is fixed.',
    /** Section 24 lists a comment; the owner made it optional on 2026-09-22. */
    commentSupport: 'Optional.',
    /** `{count}` is filled with the ceiling. */
    commentTooLong: 'Please keep this to {count} characters or fewer.',

    submit: 'Submit review',
    submitHint: 'Sends your rating for this request. A request can be reviewed once.',

    /**
     * The one review a request gets, read back (section 24: "Review Submitted →
     * Read-only Review"). No edit, because section 24 gives a customer none.
     */
    yourReviewTitle: 'Your review',
    submittedLabel: 'Sent',
    commentLabelReadOnly: 'Comment',
    successTitle: 'Review submitted',
    successMessage: 'Thank you. Your review is saved with this request and cannot be changed.',

    unavailableTitle: 'This request cannot be reviewed yet',
    unavailableMessage: 'You can rate a request once the work on it is completed.',

    notFoundTitle: 'We could not find this request',
    notFoundMessage: 'The reference may be out of date.',

    backToRequest: 'Back to request',
    backToRequestHint: 'Returns to the details of this request',

    /** On Request Details, for a completed or closed request with no review. */
    detailsPrompt: 'The work on this request is complete. Let us know how it went.',
    detailsAction: 'Rate your experience',
    detailsActionHint: 'Opens the review for this request',
    /** Heads the inline failure when the review could not be checked. */
    detailsFailedTitle: 'We could not check your review',
  }),

  /**
   * The customer's profile (PROJECT_BIBLE.md section 25), read-only.
   *
   * ⚠️ Only what the screen can do. There is no "Edit", "Change photo" or
   * "Addresses" wording here because none of them is built, and a label for a
   * control that does not exist is how one gets drawn anyway.
   */
  profile: Object.freeze({
    /** Section 26 names the tab. */
    title: 'Profile',

    contactTitle: 'Contact details',
    phoneLabel: 'Phone',
    /** Drawn only when the account has an email; never "Add email". */
    emailLabel: 'Email',

    /** Separated from the details: it is the one thing here that does anything. */
    logout: 'Log out',
    logoutHint: 'Asks before signing you out of Fixora on this device',

    /** The owner's wording, 2026-09-22. */
    logoutConfirmTitle: 'Log out?',
    logoutConfirmMessage: 'You will need to sign in again to access your account.',
    logoutCancel: 'Cancel',
    logoutCancelHint: 'Keeps you signed in',
    logoutConfirm: 'Log out',
    logoutConfirmHint: 'Signs you out now',

    /** Above the retry when signing out could not finish on this device. */
    logoutFailedTitle: 'We could not log you out',

    /* ---- Phase 3D-9: the address book (section 18, reached from section 25) ---- */

    addresses: 'Manage Addresses',
    addressesHint: 'Opens the addresses you have saved',

    /* ---- Phase 3D-8: editing, and the picture (section 25) ---- */

    /** Opens the form. Section 26 puts Edit Profile below Profile. */
    edit: 'Edit Profile',
    editHint: 'Opens a form for your name and email',

    /** The picture's own actions, on Profile because section 25 puts them there. */
    photoTitle: 'Profile picture',
    photoCamera: 'Take a photo',
    photoGallery: 'Choose a photo',
    photoRemove: 'Remove photo',
    photoRemoveHint: 'Deletes the picture from your account',
    /** Before the upload has said how far it has got; spoken once. Then the bar's spoken name. */
    photoUploading: 'Saving your picture…',
    /**
     * Beside the bar once the upload reports a figure — the vendor photo cards'
     * words (3G-4), so an upload reads the same in both apps.
     */
    photoProgress: (percent: number) => `Uploading… ${percent}%`,
    /** Heads the inline failure. The retry is the action beneath it. */
    photoFailedTitle: 'We could not save your picture',
    photoRetry: 'Try again',
    photoDiscard: 'Discard',
    photoDiscardHint: 'Forgets the picture you chose',
  }),

  /**
   * Editing the profile (PROJECT_BIBLE.md section 25, Phase 3D-8).
   *
   * ⚠️ Nothing here promises more than the form does. There is no wording for
   * changing a phone number or verifying an email, because neither is built —
   * and a label is how an unbuilt control gets drawn anyway.
   */
  editProfile: Object.freeze({
    title: 'Edit Profile',
    subtitle: 'Change how your name and email appear on your requests.',

    firstNameLabel: 'First name',
    firstNamePlaceholder: 'Your first name',
    lastNameLabel: 'Last name',
    lastNamePlaceholder: 'Optional',
    emailLabel: 'Email',
    emailPlaceholder: 'Optional',
    /** Says why the box below it cannot be typed in, before anyone tries. */
    emailHelp: 'We use this for receipts and updates. Leave it empty to remove it.',

    phoneLabel: 'Phone',
    /** Read-only: section 7A makes the number the account itself. */
    phoneHelp: 'You sign in with this number, so it cannot be changed here.',

    save: 'Save',
    saveHint: 'Saves your details and returns to your profile',
    saving: 'Saving…',
    /** Heads the inline failure above Save, never inside a dialog. */
    saveFailedTitle: 'We could not save your profile',

    /** Leaving with edits that were never saved. */
    discardTitle: 'Discard changes?',
    discardMessage: 'Your changes have not been saved yet.',
    discardKeep: 'Keep editing',
    discardKeepHint: 'Returns to the form',
    discardConfirm: 'Discard',
    discardConfirmHint: 'Leaves without saving',
  }),

  /**
   * The customer's saved addresses (PROJECT_BIBLE.md section 18, Phase 3D-9).
   *
   * ⚠️ No wording for a label, a map or a pin. Section 63 puts Home / Office /
   * Other and map selection in Phase 2, and a label here is how one gets drawn.
   */
  addressBook: Object.freeze({
    title: 'Saved addresses',
    subtitle: 'Addresses you can reuse the next time you book a visit.',

    /** Marks the one address a visit defaults to. Never colour alone. */
    defaultBadge: 'Default',
    /** Spoken after the address itself, so a card announces what it is. */
    defaultSpoken: 'Default address',

    add: 'Add Address',
    addHint: 'Saves a new address to your account',
    edit: 'Edit',
    /** Completed with the address, so the action says which one it acts on. */
    editHint: 'Edit',
    remove: 'Delete',
    removeHint: 'Delete',
    setDefault: 'Set as default',
    setDefaultHint: 'Use this address by default',

    /** The book is empty for every customer until they add their first. */
    emptyTitle: 'No saved addresses yet',
    emptyMessage: 'Save an address here and it will be ready the next time you book a visit.',

    /** Said while the first read is in flight; announced politely. */
    loading: 'Loading your addresses',
    failedTitle: 'We could not load your addresses',
    /** The gazetteer failed; what was typed is still saveable, so this is inline. */
    searchFailedTitle: 'We could not search for addresses',
    /** Heads an inline failure above the list, when the list itself is fine. */
    changeFailedTitle: 'We could not save that change',

    /** Removing one asks first — it cannot be undone. */
    removeTitle: 'Delete this address?',
    /** Completed with the address, so the dialog names what is going. */
    removeMessage: 'This will remove',
    removeCancel: 'Cancel',
    removeCancelHint: 'Keeps the address',
    removeConfirm: 'Delete',
    removeConfirmHint: 'Deletes the address now',

    /* ---- adding and editing one ---- */

    addTitle: 'Add Address',
    addSubtitle: 'Find the address you would like to save.',
    editTitle: 'Edit Address',
    editSubtitle: 'Change where this address points.',

    save: 'Save',
    saveHint: 'Saves this address and returns to your addresses',
    saving: 'Saving…',
    saveFailedTitle: 'We could not save this address',

    /** Leaving with an address that was never saved. */
    discardTitle: 'Discard changes?',
    discardMessage: 'This address has not been saved yet.',
    discardKeep: 'Keep editing',
    discardKeepHint: 'Returns to the form',
    discardConfirm: 'Discard',
    discardConfirmHint: 'Leaves without saving',
  }),

  request: Object.freeze({
    /**
     * The vendor row before assignment.
     *
     * Deliberately neutral about why. PROJECT_BIBLE.md section 20 gives
     * different wording for a request waiting on one chosen vendor and one in
     * open dispatch, and the summary contract carries no dispatch mode — so
     * anything more specific than this would be the app guessing which wait the
     * customer is in.
     */
    vendorPending: 'Vendor not assigned yet',

    /** Prefixes the request's identifier — the reference Request Submitted gives. */
    referencePrefix: 'Ref',

    /** Screen-reader wording, so a badge is not read as a loose word. */
    statusLabel: 'Status',
    priorityLabel: 'Priority',

    /** Every card opens its request, so the hint says where rather than what. */
    openHint: 'Opens the details of this request',
  }),
});

/**
 * Relative-time wording.
 *
 * Separated from the block above because these are fragments assembled with a
 * number rather than sentences, and mixing the two invites a translator to
 * treat a fragment as a sentence.
 */
export { RELATIVE_TIME_COPY } from '@/shared/presentation/requestTokens';
