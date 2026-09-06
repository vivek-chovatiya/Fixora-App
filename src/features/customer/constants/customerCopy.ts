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
    categoryHint: 'Opens service categories',
    categoriesEmptyTitle: 'No services listed yet',
    categoriesEmptyMessage:
      'Services appear here as soon as they are available in your area.',

    recentTitle: 'Recent requests',

    /** PROJECT_BIBLE.md section 48 fixes this sentence and its action. */
    recentEmptyTitle: "You don't have any service requests yet.",
    recentEmptyMessage: 'Your requests will show up here so you can follow them at a glance.',

    /** Names the screen for assistive technology, which the tab label alone does not. */
    screenLabel: 'Home',
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
    backHint: 'Returns to the categories',

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

    priorityTitle: 'How urgent is it?',
    prioritySupport: 'This helps us decide how quickly to find someone.',

    dateTitle: 'Preferred date',
    timeTitle: 'Preferred time',
    /** Both are preferences, and section 14 makes both optional. */
    scheduleSupport: 'Optional. We will do our best, and confirm before anyone visits.',
    anyDate: 'No preference',
    anyTime: 'No preference',
    today: 'Today',
    tomorrow: 'Tomorrow',
    dateHint: 'Sets the day you would prefer',
    timeHint: 'Sets the time you would prefer',

    photosTitle: 'Photos',
    photosSupport: 'Optional. A picture of the problem saves everyone a phone call.',
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
    backHint: 'Returns to the request details',

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

    /** Names the group of options for assistive technology. */
    optionsLabel: 'Available professionals',

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

    submit: 'Submit Request',
    submitHint: 'Sends your request',

    /** Spoken while the list is still a set of placeholders. */
    loadingLabel: 'Loading professionals',
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

    /** Prefixes the identifier a customer can quote when they get in touch. */
    referencePrefix: 'Ref',

    /** Screen-reader wording, so a badge is not read as a loose word. */
    statusLabel: 'Status',
    priorityLabel: 'Priority',
  }),
});

/**
 * Relative-time wording.
 *
 * Separated from the block above because these are fragments assembled with a
 * number rather than sentences, and mixing the two invites a translator to
 * treat a fragment as a sentence.
 */
export const RELATIVE_TIME_COPY = Object.freeze({
  justNow: 'Just now',
  minute: '{count} min ago',
  hour: '{count} hr ago',
  day: '{count} day ago',
  days: '{count} days ago',
});
