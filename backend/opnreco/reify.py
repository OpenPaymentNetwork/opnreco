from typing import Callable, Generic, TypeVar

InstanceType = TypeVar("InstanceType")
PropType = TypeVar("PropType")


class reify(Generic[InstanceType, PropType]):
    """Use as a class method decorator.  It operates like the
    Python ``@property`` decorator, but it puts the result of the method it
    decorates into the instance dict after the first call, effectively
    replacing the function it decorates with an instance variable.  It is, in
    Python parlance, a non-data descriptor.  The following is an example of
    its usage:

    .. doctest::

        >>> from wingcashmisc import reify

        >>> class Foo(object):
        ...     @reify
        ...     def jammy(self):
        ...         print('jammy called')
        ...         return 1

        >>> f = Foo()
        >>> v = f.jammy
        jammy called
        >>> print(v)
        1
        >>> f.jammy
        1
        >>> # jammy func not called the second time; it replaced itself with 1
        >>> # Note: reassignment is possible
        >>> f.jammy = 2
        >>> f.jammy
        2

    Copied from Pyramid. Added type annotations.
    """

    def __init__(self, wrapped: Callable[[InstanceType], PropType]):
        self.wrapped = wrapped
        self.__doc__ = wrapped.__doc__

    def __get__(self, inst: InstanceType, objtype=None) -> PropType:
        if inst is None:
            # The attribute is being fetched from the class, not an
            # instance. It's ok to ignore type checking on the next
            # line because type checkers prevent this usage anyway:
            # the precondition that "inst" is an InstanceType would
            # not be met when "inst" is None. OTOH, dynamic code can
            # get the attribute from the class, so it's
            # appropriate to return self.
            return self  # type: ignore
        val = self.wrapped(inst)
        setattr(inst, self.wrapped.__name__, val)
        return val
