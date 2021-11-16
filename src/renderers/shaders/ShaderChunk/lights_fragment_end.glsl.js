export default /* glsl */`
#if defined( RE_IndirectDiffuse )

	RE_IndirectDiffuse( irradiance, geometry, material, reflectedLight );

#endif

#if defined( RE_IndirectSpecular )

	RE_IndirectSpecular(
		radiance, iblIrradiance, clearcoatRadiance, splitGeoNormal,
		#ifdef CLEARCOAT
		splitGeoClearcoatNormal,
		#endif
		geometry, material, reflectedLight
	);

#endif

#ifdef ENVMAP_MODE_REFLECTION

reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, radianceRefraction * diffuseColor.rgb, refraction);

#endif
`;
