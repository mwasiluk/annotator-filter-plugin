class Annotator.Plugin.Filter extends Annotator.Plugin
  # Events and callbacks to bind to the Filter#element.
  events:
    ".annotator-filter-property input focus": "_onFilterFocus"
    ".annotator-filter-property input blur":  "_onFilterBlur"
    ".annotator-filter-property input keyup": "_onFilterKeyup"
    ".annotator-filter-property input[type='checkbox'] change": "_onBooleanFilterChange",
    ".annotator-filter-previous click":       "_onPreviousClick"
    ".annotator-filter-next click":           "_onNextClick"
    ".annotator-filter-clear click":          "_onClearClick"

  # Common classes used to change plugin state.
  classes:
    active:   'annotator-filter-active'
    hl:
      hide:   'annotator-hl-filtered'
      active: 'annotator-hl-active'

  # HTML templates for the plugin UI.
  html:
    element: """
             <div class="annotator-filter"></div>
             """
    navigation: """
             <span class="annotator-filter-navigation-wrapper">
                 <strong>""" + Annotator._t('Navigate:') + """</strong>
                 <span class="annotator-filter-navigation">
                    <button class="annotator-filter-previous">""" + Annotator._t('Previous') + """</button>
                    <button class="annotator-filter-next">""" + Annotator._t('Next') + """</button>
                 </span>
             </span>
             """
    filterBy: """
             <strong>""" + Annotator._t('Filter by:') + """</strong>
             """
    filter:  """
             <span class="annotator-filter-property">
               <label></label>
               <input/>
               <button class="annotator-filter-clear">""" + Annotator._t('Clear') + """</button>
             </span>
             """
    filterBoolean:  """
             <span class="annotator-filter-property filter-boolean">
               <label>

                </label>
                <input type='checkbox'/>
             </span>
             """

  # Default options for the plugin.
  options:
    # A CSS selector or Element to append the plugin toolbar to.
    appendTo: 'body'

    #Add margin to the current document
    insertSpacer: true

    showNavigation: true

    showFilterByLabel: true

    # An array of filters can be provided on initialisation.
    filters: []

    # Adds a default filter on annotations.
    addAnnotationFilter: true

    keyUpDebounce: 300

    idPrefix: ''

    # Public: Determines if the property is contained within the provided
    # annotation property. Default is to split the string on spaces and only
    # return true if all keywords are contained in the string. This method
    # can be overridden by the user when initialising the plugin.
    #
    # string   - An input String from the fitler.
    # property - The annotation propery to query.
    #
    # Examples
    #
    #   plugin.option.getKeywords('hello', 'hello world how are you?')
    #   # => Returns true
    #
    #   plugin.option.getKeywords('hello bill', 'hello world how are you?')
    #   # => Returns false
    #
    # Returns an Array of keyword Strings.
    isFiltered: (input, property, isBoolean) ->

      if isBoolean
          return !!input == !!property

      return false unless input and property

      propertyLowerCase = property.toLowerCase()
      for keyword in (input.toLowerCase().split /\s+/)
        return false if  propertyLowerCase.indexOf(keyword) == -1

      return true

  # Public: Creates a new instance of the Filter plugin.
  #
  # element - The Annotator element (this is ignored by the plugin).
  # options - An Object literal of options.
  #
  # Examples
  #
  #   filter = new Annotator.Plugin.Filter(annotator.element)
  #
  # Returns a new instance of the Filter plugin.
  constructor: (element, options) ->
    # As most events for this plugin are relative to the toolbar which is
    # not inside the Annotator#Element we override the element property.
    # Annotator#Element can still be accessed via @annotator.element.

    element = $(@html.element).appendTo(options?.appendTo or @options.appendTo)

    super element, options

    @options.filters or= []

    @filter  = $(@html.filter)
    @filterBoolean  = $(@html.filterBoolean)
    @filters = []
    @current  = 0

    @debouncedOnFilterKeyUp = @debounce((event) ->
          filter = $(event.target).parent().data('filter')
          this.updateFilter filter if filter
    @options.keyUpDebounce)

  # Public: Adds new filters. Updates the @highlights cache and creates event
  # listeners on the annotator object.
  #
  # Returns nothing.
  pluginInit: ->
    if @options.showNavigation
      $(@html.navigation).appendTo(@element)

    if @options.showFilterByLabel
      $(@html.filterBy).appendTo(@element)

    for filter in @options.filters
      this.addFilter(filter)

    this.updateHighlights()
    this._setupListeners()

    if this.options.insertSpacer
      this._insertSpacer()

    if @options.addAnnotationFilter == true
      this.addFilter {label: Annotator._t('Annotation'), property: 'text'}

  # Public: remove the filter plugin instance and unbind events.
  #
  # Returns nothing.
  destroy: ->
    super
    html = $('html')
    currentMargin = parseInt(html.css('padding-top'), 10) || 0
    html.css('padding-top', currentMargin - @element.outerHeight())
    @element.remove()

  # Adds margin to the current document to ensure that the annotation toolbar
  # doesn't cover the page when not scrolled.
  #
  # Returns itself
  _insertSpacer: ->
    html = $('html')
    currentMargin = parseInt(html.css('padding-top'), 10) || 0
    html.css('padding-top', currentMargin + @element.outerHeight())
    this




  # Listens to annotation change events on the Annotator in order to refresh
  # the @annotations collection.
  # TODO: Make this more granular so the entire collection isn't reloaded for
  # every single change.
  #
  # Returns itself.
  _setupListeners: ->
    events = [
      'annotationsLoaded', 'annotationCreated',
      'annotationUpdated', 'annotationDeleted'
    ]
    plugin = this

    delayedUpdateHighlights = () ->
        setTimeout plugin.updateFilters, 2


    for event in events
      @annotator.subscribe event, delayedUpdateHighlights


    this

  # Public: Adds a filter to the toolbar. The filter must have both a label
  # and a property of an annotation object to filter on.
  #
  # options - An Object literal containing the filters options.
  #           label      - A public facing String to represent the filter.
  #           property   - An annotation property String to filter on.
  #           isFiltered - A callback Function that recieves the field input
  #                        value and the annotation property value. See
  #                        @options.isFiltered() for details.
  #           isBoolean  - checkbox filter
  #           enabled    - convenience property for enabling/disabling filters
  #
  # Examples
  #
  #   # Set up a filter to filter on the annotation.user property.
  #   filter.addFilter({
  #     label: User,
  #     property: 'user'
  #   })
  #
  # Returns itself to allow chaining.
  addFilter: (options) ->
    filter = $.extend({
      label: ''
      property: ''
      isFiltered: @options.isFiltered
      isBoolean: false
      isAlwaysActive: false
      enabled: true
    }, options)

    if filter.enabled
      unless (f for f in @filters when f.property == filter.property and f.isBoolean == filter.isBoolean).length

        filter.id = @options.idPrefix+'annotator-filter-' + filter.property
        if filter.isBoolean
            filter.id+='-boolean'

        if filter.name
            filter.id+='-'+filter.name

        filter.annotations = []
        if filter.isBoolean
            filter.element = @filterBoolean.clone().appendTo(@element)
        else
            filter.element = @filter.clone().appendTo(@element)

        filter.element.find('label')
            .html(filter.label)
            .attr('for', filter.id)
        inputElement = filter.element.find('input')

        inputElement.attr({
              id: filter.id
            })

        if !filter.isBoolean
              inputElement.attr({
                  placeholder: Annotator._t('Filter by ') + filter.label + '\u2026'
              })
              filter.element.find('button').hide()


        # Add the filter to the elements data store.
        filter.element.data 'filter', filter

        @filters.push filter

    this

  # Public: Updates the filter.annotations property. Then updates the state
  # of the elements in the DOM. Calls the filter.isFiltered() method to
  # determine if the annotation should remain.
  #
  # filter - A filter Object from @filters
  #
  # Examples
  #
  #   filter.updateFilter(myFilter)
  #
  # Returns itself for chaining
  updateFilter: (filter) ->

    this.updateHighlights()
    this.resetHighlights()
    oldVal = filter.currentInputVal

    this.updateFilterState filter

    changed = filter.currentInputVal != oldVal

    if changed
        this.filterHighlights()
        this.publishFilteredEvent()

  updateFilterState: (filter) ->
      filter.annotations = []

      inputElement = filter.element.find('input')
      if filter.isBoolean
          input = inputElement.is(":checked")
      else
          input = $.trim inputElement.val()

      filter.isActive = filter.isAlwaysActive or !!input
      filter.currentInputVal = input;

      if filter.isActive
          annotations = @highlights.map -> $(this).data('annotation')

          for annotation in $.makeArray(annotations)
              property = annotation[filter.property]
              if filter.isFiltered input, property, filter.isBoolean
                  filter.annotations.push annotation


  updateFilters: =>
      this.updateHighlights()
      this.resetHighlights()
      for filter in @filters
          this.updateFilterState filter

      this.filterHighlights()


  publishFilteredEvent: =>
      activeFilters = $.grep @filters, (filter) -> filter.isActive
      if !activeFilters
          activeFilters = []

      af = []
      for f in activeFilters
          af.push {name: f.name, property: f.property, value: f.currentInputVal}
      @annotator.publish('annotationsFiltered', [af])

      this

  # Public: Updates the @highlights property with the latest highlight
  # elements in the DOM.
  #
  # Returns a jQuery collection of the highlight elements.
  updateHighlights: =>
    # Ignore any hidden highlights.
    @highlights = @annotator.element.find('.annotator-hl:visible')
    @filtered   = @highlights.not(@classes.hl.hide)

  # Public: Runs through each of the filters and removes all highlights not
  # currently in scope.
  #
  # Returns itself for chaining.
  filterHighlights: ->
    activeFilters = $.grep @filters, (filter) -> filter.isActive
    if !activeFilters.length
        return this

    filtered = activeFilters[0]?.annotations || []
    if activeFilters.length > 1
      # If there are more than one filter then only annotations matched in every
      # filter should remain.

      filtered = this.intersection(activeFilters.map (f) -> f.annotations)

    console.log(filtered)
    highlights = @highlights
    for annotation, index in filtered
      highlights = highlights.not(annotation.highlights)

    highlights.addClass(@classes.hl.hide)

    @filtered = @highlights.not(@classes.hl.hide)
    this

  # Public: Removes hidden class from all annotations.
  #
  # Returns itself for chaining.
  resetHighlights: ->
    @highlights.removeClass(@classes.hl.hide)
    @filtered = @highlights
    this

  # Updates the filter field on focus.
  #
  # event - A focus Event object.
  #
  # Returns nothing
  _onFilterFocus: (event) =>
    input = $(event.target)
    input.parent().addClass(@classes.active)
    input.next('button').show()

  # Updates the filter field on blur.
  #
  # event - A blur Event object.
  #
  # Returns nothing.
  _onFilterBlur: (event) =>
    unless event.target.value
      input = $(event.target)
      input.parent().removeClass(@classes.active)
      input.next('button').hide()

  # Updates the filter based on the id of the filter element.
  #
  # event - A keyup Event
  #
  # Returns nothing.
  _onFilterKeyup: (event) =>
    this.debouncedOnFilterKeyUp(event)



  _onBooleanFilterChange: (event) =>
      input = $(event.target)
      filter = input.parent().data('filter')
      inputVal = input.is(":checked")
      if !inputVal
          input.parent().removeClass(@classes.active)

      this.updateFilter filter if filter

  # Locates the next/previous highlighted element in @highlights from the
  # current one or goes to the very first/last element respectively.
  #
  # previous - If true finds the previously highlighted element.
  #
  # Returns itself.
  _findNextHighlight: (previous) ->
    return this unless @highlights.length

    offset      = if previous then 0    else -1
    resetOffset = if previous then -1   else 0
    operator    = if previous then 'lt' else 'gt'

    active  = @highlights.not('.' + @classes.hl.hide)
    current = active.filter('.' + @classes.hl.active)
    current = active.eq(offset) unless current.length

    annotation = current.data 'annotation'

    index = active.index current[0]
    next  = active.filter(":#{operator}(#{index})").not(annotation.highlights).eq(resetOffset)
    next  = active.eq(resetOffset) unless next.length

    this._scrollToHighlight next.data('annotation').highlights

  # Locates the next highlighted element in @highlights from the current one
  # or goes to the very first element.
  #
  # event - A click Event.
  #
  # Returns nothing
  _onNextClick: (event) =>
    this._findNextHighlight()

  # Locates the previous highlighted element in @highlights from the current one
  # or goes to the very last element.
  #
  # event - A click Event.
  #
  # Returns nothing
  _onPreviousClick: (event) =>
    this._findNextHighlight true

  # Scrolls to the highlight provided. An adds an active class to it.
  #
  # highlight - Either highlight Element or an Array of elements. This value
  #             is usually retrieved from annotation.highlights.
  #
  # Returns nothing.
  _scrollToHighlight: (highlight) ->
    highlight = $(highlight)

    @highlights.removeClass(@classes.hl.active)
    highlight.addClass(@classes.hl.active)

    $('html, body').animate({
      scrollTop: highlight.offset().top - (@element.height() + 20)
    }, 150)

  # Clears the relevant input when the clear button is clicked.
  #
  # event - A click Event object.
  #
  # Returns nothing.
  _onClearClick: (event) ->
    $(event.target).prev('input').val('').keyup().blur()


  intersection: (arrays) ->
      return arrays.shift().reduce(((res, v) ->
          if res.indexOf(v) == -1 and arrays.every(((a) ->
              a.indexOf(v) != -1
          ))
              res.push v
          res
      ), [])

  debounce: (func, threshold, execAsap) ->
    timeout = null
    (args...) ->
        obj = this
        delayed = ->
            func.apply(obj, args) unless execAsap
            timeout = null
        if timeout
            clearTimeout(timeout)
        else if (execAsap)
            func.apply(obj, args)
        timeout = setTimeout delayed, threshold || 100

  throttle: (fn, threshold, scope) ->
    threshold or (threshold = 250)
    last = undefined
    deferTimer = undefined
    ->
        context = scope or this
        now = +new Date
        args = arguments
        if last and now < last + threshold
            # hold on to it
            clearTimeout deferTimer
            deferTimer = setTimeout((->
                last = now
                fn.apply context, args
                return
            ), threshold)
        else
            last = now
            fn.apply context, args
        return
